import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, setDoc, addDoc, deleteDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, Book, UserProfile, Reservation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  BookOpen, Clock, AlertCircle, RefreshCw, Calendar, 
  CheckCircle2, Loader2, User as UserIcon, Edit2, Save, X, RotateCcw, Bookmark, ShoppingBag, Sparkles, Camera, Check
} from 'lucide-react';

import { Modal } from '../components/ui/Modal';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [borrowedBooks, setBorrowedBooks] = useState<(Transaction & { bookTitle?: string; bookCover?: string })[]>([]);
  const [reservations, setReservations] = useState<(Reservation & { bookTitle?: string; bookCover?: string })[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [totalFines, setTotalFines] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRenewing, setIsRenewing] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    type: 'default' | 'danger' | 'warning' | 'success';
    onConfirm?: () => void;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'default'
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Fetch Profile
    const profileUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        setEditName(data.name);
        setEditPhotoURL(data.photoURL || '');
      }
    });

    // Fetch borrowed transactions
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('status', 'in', ['borrowed', 'overdue'])
    );

    const transUnsub = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setBorrowedBooks(transactions);
      setIsLoading(false);
    }, (err) => {
      console.error('Dashboard sync error:', err);
      setIsLoading(false);
    });

    // Fetch all transactions for this user to calculate total fines
    const allTransQ = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );

    const allTransUnsub = onSnapshot(allTransQ, (snapshot) => {
      const total = snapshot.docs.reduce((acc, docSnap) => {
        const data = docSnap.data();
        let fine = data.fineAmount || 0;
        // If still borrowed, calculate live fine
        if (data.status !== 'returned' && data.dueDate) {
          fine += calculateFine(data.dueDate);
        }
        return acc + fine;
      }, 0);
      setTotalFines(total);
    });

    // Fetch reservations
    const resQ = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const resUnsub = onSnapshot(resQ, (snapshot) => {
      const resData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setReservations(resData);
    });

    // Fetch notifications
    const notifQ = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const notifUnsub = onSnapshot(notifQ, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      profileUnsub();
      transUnsub();
      allTransUnsub();
      resUnsub();
      notifUnsub();
    };
  }, []);

  const calculateFine = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    if (now <= due) return 0;
    
    const diffTime = Math.abs(now.getTime() - due.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays * 10; // ₹10 per day
  };

  const handleRenew = async (transactionId: string, currentDueDate: string) => {
    setIsRenewing(transactionId);
    try {
      const newDueDate = new Date(currentDueDate);
      newDueDate.setDate(newDueDate.getDate() + 14);

      await updateDoc(doc(db, 'transactions', transactionId), {
        dueDate: newDueDate.toISOString()
      });
      toast.success('Book renewed successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${transactionId}`);
    } finally {
      setIsRenewing(null);
    }
  };

  const handleReturnAction = async (transaction: any) => {
    setIsReturning(transaction.id);
    try {
      const returnDate = new Date().toISOString();
      const fine = transaction.dueDate ? calculateFine(transaction.dueDate) : 0;

      // 1. Update Transaction
      await updateDoc(doc(db, 'transactions', transaction.id), {
        status: 'returned',
        returnDate: returnDate,
        fineAmount: fine
      });

      // 2. Update Book Availability
      const bookRef = doc(db, 'books', transaction.bookId);
      const bookSnap = await getDoc(bookRef);
      let newAvailable = 0;
      
      if (bookSnap.exists()) {
        const bookData = bookSnap.data();
        newAvailable = (bookData?.availableCopies || 0) + 1;
        await updateDoc(bookRef, {
          availableCopies: newAvailable
        });
      }

      // 3. Check for Reservations (Pro Priority)
      if (newAvailable > 0) {
        // Try to find the oldest Pro reservation first
        let resQ = query(
          collection(db, 'reservations'),
          where('bookId', '==', transaction.bookId),
          where('status', '==', 'pending'),
          where('isPro', '==', true),
          orderBy('reservationDate', 'asc'),
          limit(1)
        );
        let resSnap = await getDocs(resQ);
        
        // If no Pro user found, do a general query
        if (resSnap.empty) {
          resQ = query(
            collection(db, 'reservations'),
            where('bookId', '==', transaction.bookId),
            where('status', '==', 'pending'),
            orderBy('reservationDate', 'asc'),
            limit(1)
          );
          resSnap = await getDocs(resQ);
        }
        
        if (!resSnap.empty) {
          const oldestRes = resSnap.docs[0];
          const resData = oldestRes.data();
          
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          await addDoc(collection(db, 'notifications'), {
            userId: resData.userId,
            bookId: transaction.bookId,
            bookTitle: transaction.bookTitle || 'A reserved book',
            message: `The book "${transaction.bookTitle || 'you reserved'}" is now available! Click below to borrow it immediately.`,
            type: 'availability',
            priority: 'high',
            read: false,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            canOneClickBorrow: true,
            reservationId: oldestRes.id
          });
        }
      }

      toast.success('Book returned successfully!');
      if (fine > 0) {
        toast(`Overdue fine of ₹${fine} applied.`, { icon: '💰' });
      }
    } catch (err: any) {
      console.error('Return error:', err);
      toast.error(`Failed to return book: ${err.message || 'Please try again.'}`);
    } finally {
      setIsReturning(null);
    }
  };

  const handleReturn = (transaction: any) => {
    if (!transaction?.id || !transaction?.bookId) {
      toast.error('Invalid transaction data. Cannot process return.');
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'Return Book',
      message: (
        <p>Are you sure you want to return <span className="font-bold text-slate-900">"{transaction.bookTitle}"</span>? This will make the book available for others.</p>
      ),
      type: 'warning',
      confirmLabel: 'Return Book',
      onConfirm: () => handleReturnAction(transaction)
    });
  };

  const handleOneClickBorrow = async (notif: any) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      toast.loading('Processing borrow...', { id: 'one-click' });
      
      // 1. Create Transaction
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        bookId: notif.bookId,
        bookTitle: notif.bookTitle,
        issueDate: new Date().toISOString(),
        dueDate: dueDate.toISOString(),
        status: 'borrowed',
        fineAmount: 0
      });

      // 2. Update Book Availability
      const bookRef = doc(db, 'books', notif.bookId);
      const bookSnap = await getDoc(bookRef);
      if (bookSnap.exists()) {
        const currentAvailable = bookSnap.data().availableCopies || 0;
        await updateDoc(bookRef, {
          availableCopies: Math.max(0, currentAvailable - 1)
        });
      }

      // 3. Mark Reservation as Fulfilled
      if (notif.reservationId) {
        await updateDoc(doc(db, 'reservations', notif.reservationId), {
          status: 'fulfilled'
        });
      }

      // 4. Mark Notification as Read
      await updateDoc(doc(db, 'notifications', notif.id), {
        read: true
      });

      toast.success('Book borrowed successfully!', { id: 'one-click' });
    } catch (err) {
      console.error('One-click borrow error:', err);
      toast.error('Failed to borrow book.', { id: 'one-click' });
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        read: true
      });
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', profile.id), {
        name: editName,
        photoURL: editPhotoURL
      });
      
      // Update Firebase Auth profile as well if possible
      const user = auth.currentUser;
      if (user) {
        try {
          const { updateProfile: updateFirebaseProfile } = await import('firebase/auth');
          await updateFirebaseProfile(user, { 
            displayName: editName,
            photoURL: editPhotoURL 
          });
        } catch (e) {
          console.error("Auth profile update skipped:", e);
        }
      }
      
      setIsEditingProfile(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.id}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpgrade = () => {
    navigate('/pro');
  };

  const handleCancelReservation = (id: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Cancel Reservation',
      message: 'Are you sure you want to cancel this reservation? This cannot be undone.',
      type: 'danger',
      confirmLabel: 'Cancel Reservation',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'reservations', id));
          toast.success('Reservation cancelled.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `reservations/${id}`);
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-display">My Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage your borrowed books and active reservations.</p>
        </div>
        
        {profile && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="relative group">
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon size={24} />
                )}
              </div>
              <button 
                onClick={() => setIsEditingProfile(true)}
                className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-md border border-slate-100 text-indigo-600 hover:scale-110 transition-all"
              >
                <Camera size={12} />
              </button>
            </div>
            {isEditingProfile ? (
              <div className="flex flex-col gap-2 min-w-[200px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Edit Profile</span>
                  <div className="flex gap-1">
                    <button onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile} className="p-1 text-slate-400 hover:text-rose-600 transition-colors">
                      <X size={16} />
                    </button>
                    <button onClick={handleUpdateProfile} disabled={isSavingProfile} className="p-1 text-indigo-600 hover:text-indigo-700 transition-colors">
                      {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                  </div>
                </div>
                <input 
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Full Name"
                />
                <input 
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                  value={editPhotoURL}
                  onChange={e => setEditPhotoURL(e.target.value)}
                  placeholder="Profile Photo URL"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-900">{profile.name}</p>
                    {profile.isPro && <Sparkles size={14} className="text-amber-500 fill-amber-500" />}
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{profile.role}</p>
                </div>
                <button onClick={() => setIsEditingProfile(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          {/* Notifications Section */}
          {notifications.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle size={20} className="text-amber-500" />
                  Notifications
                </h2>
              </div>
              <div className="space-y-3">
                {notifications.map((notif) => {
                  const isHighPriority = notif.priority === 'high';
                  const isExpiring = !!notif.expiresAt;
                  const hoursLeft = isExpiring 
                    ? Math.max(0, Math.floor((new Date(notif.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60)))
                    : null;

                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`border rounded-xl p-4 flex items-center justify-between transition-all ${
                        isHighPriority 
                          ? 'bg-indigo-50 border-indigo-100 shadow-sm' 
                          : 'bg-amber-50 border-amber-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isHighPriority ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          <BookOpen size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            {isHighPriority && (
                              <span className="text-[10px] uppercase font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-md tracking-wider">
                                High Priority
                              </span>
                            )}
                            <p className={`text-sm font-bold ${
                              isHighPriority ? 'text-indigo-900' : 'text-amber-900'
                            }`}>
                              {notif.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className={`text-[10px] font-bold uppercase ${
                              isHighPriority ? 'text-indigo-400' : 'text-amber-600'
                            }`}>
                              {new Date(notif.createdAt).toLocaleString()}
                            </p>
                            {isExpiring && (
                              <div className="flex items-center gap-1 text-[10px] font-black text-rose-500 uppercase">
                                <Clock size={10} />
                                Held for {hoursLeft}h
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {notif.canOneClickBorrow && (
                          <button 
                            onClick={() => handleOneClickBorrow(notif)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm ${
                              isHighPriority 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                          >
                            <ShoppingBag size={14} />
                            Borrow Now
                          </button>
                        )}
                        <button 
                          onClick={() => handleMarkAsRead(notif.id)}
                          className={`text-xs font-bold uppercase tracking-wider ${
                            isHighPriority ? 'text-indigo-400 hover:text-indigo-700' : 'text-amber-600 hover:text-amber-800'
                          }`}
                        >
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Borrowed Books Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-600" />
                Currently Borrowed
              </h2>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {borrowedBooks.length} Items
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {borrowedBooks.length > 0 ? (
                <div className="space-y-4">
                  {borrowedBooks.map((item) => {
                    const isOverdue = new Date(item.dueDate) < new Date();
                    const fine = calculateFine(item.dueDate);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                          isOverdue ? 'border-rose-200 bg-rose-50/30 shadow-sm' : 'border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-12 bg-slate-100 rounded overflow-hidden flex-shrink-0 border border-slate-100">
                            {item.bookCover ? (
                              <img src={item.bookCover} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-300">
                                <BookOpen size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{item.bookTitle || `Book ID: ${item.bookId}`}</h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                              <div className="flex items-center text-sm text-slate-500">
                                <Calendar size={14} className="mr-1" />
                                {new Date(item.issueDate).toLocaleDateString()}
                              </div>
                              <div className={`flex items-center text-sm font-medium ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                                <Clock size={14} className="mr-1" />
                                Due: {new Date(item.dueDate).toLocaleDateString()}
                                {isOverdue && <span className="ml-2 text-[10px] uppercase font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded">Overdue</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {fine > 0 && (
                            <div className="mr-4 text-right">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Current Fine</p>
                              <p className="text-rose-600 font-bold">₹{fine.toLocaleString('en-IN')}</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRenew(item.id, item.dueDate)}
                              disabled={isRenewing === item.id || isOverdue}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-all"
                            >
                              {isRenewing === item.id ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                              Renew
                            </button>
                            <button
                              onClick={() => handleReturn(item)}
                              disabled={isReturning === item.id}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                            >
                              {isReturning === item.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                              Return
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white border border-dashed border-slate-300 rounded-xl py-12 flex flex-col items-center justify-center text-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4 text-slate-300">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-slate-900 font-semibold">No active loans</h3>
                  <p className="text-slate-500 text-sm max-w-xs mt-1">Enjoy our catalog and find your next book!</p>
                </div>
              )}
            </AnimatePresence>
          </section>

          {/* Reservations Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Bookmark size={20} className="text-indigo-600" />
                Active Reservations
              </h2>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {reservations.length} Pending
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reservations.length > 0 ? (
                reservations.map((res) => (
                  <div key={res.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-9 bg-slate-100 rounded overflow-hidden flex-shrink-0 border border-slate-100">
                        {res.bookCover ? (
                          <img src={res.bookCover} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-300">
                            <Bookmark size={14} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 line-clamp-1">{res.bookTitle || `Book ID: ${res.bookId}`}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Reserved {new Date(res.reservationDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCancelReservation(res.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-2 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl py-8 flex flex-col items-center justify-center text-center">
                  <p className="text-slate-400 text-sm">No active reservations.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Account Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Fines</span>
                <span className="text-sm font-bold text-rose-600">₹{totalFines.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-500 uppercase">Limit</span>
                <span className="text-sm font-bold text-slate-900">{profile.isPro ? 'Unlimited' : '5 Books'}</span>
              </div>
            </div>
          </div>

            <div className={`p-6 text-white rounded-2xl shadow-xl transition-all ${profile?.isPro ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                {profile?.isPro ? <><Sparkles size={20} /> Lumina Pro Active</> : 'Lumina Pro'}
              </h3>
              <p className={`${profile?.isPro ? 'text-amber-50' : 'text-indigo-100'} text-sm mb-6 leading-relaxed`}>
                {profile?.isPro 
                  ? 'You are enjoying unlimited borrowing and premium features across the entire library.' 
                  : 'Upgrade to Pro for unlimited borrowing, extended due dates, and home delivery services.'}
              </p>
              {!profile?.isPro && (
                <button 
                  onClick={handleUpgrade}
                  className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all active:scale-95 shadow-sm"
                >
                  Upgrade Membership
                </button>
              )}
            </div>
        </div>
      </div>

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        type={modalConfig.type}
        confirmLabel={modalConfig.confirmLabel}
        onConfirm={modalConfig.onConfirm}
      >
        {modalConfig.message}
      </Modal>
    </div>
  );
}
