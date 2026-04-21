import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, setDoc, addDoc, deleteDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth, storage, handleFirestoreError, OperationType, logActivity } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../lib/image-utils';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      await logActivity({
        type: 'user',
        user: { name: auth.currentUser?.displayName || 'Member' },
        action: `Renewed book loan`,
        details: `Transaction ID: ${transactionId}`,
        status: 'SUCCESS'
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
        await logActivity({
          type: 'user',
          user: { name: auth.currentUser?.displayName || 'Member' },
          action: `Returned book: ${bookData?.title || 'Unknown'}`,
          details: `Transaction ID: ${transaction.id}`,
          status: 'SUCCESS'
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

      await updateDoc(doc(db, 'notifications', notif.id), {
        read: true
      });

      await logActivity({
        type: 'user',
        user: { name: auth.currentUser?.displayName || 'Member' },
        action: `Borrowed book via reservation: ${notif.bookTitle}`,
        details: `Book ID: ${notif.bookId}`,
        status: 'SUCCESS'
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
      let finalPhotoURL = profile.photoURL || '';

      if (selectedFile) {
        toast.loading('Optimizing avatar...', { id: 'upload' });
        const compressedFile = await compressImage(selectedFile);
        
        toast.loading('Uploading avatar...', { id: 'upload' });
        const storageRef = ref(storage, `avatars/${profile.id}/${compressedFile.name}`);
        const snapshot = await uploadBytes(storageRef, compressedFile);
        finalPhotoURL = await getDownloadURL(snapshot.ref);
        toast.success('Avatar optimized & uploaded!', { id: 'upload' });
      }

      await updateDoc(doc(db, 'users', profile.id), {
        name: editName,
        photoURL: finalPhotoURL
      });
      
      // Update Firebase Auth profile as well if possible
      const user = auth.currentUser;
      if (user) {
        try {
          await updateProfile(user, { 
            displayName: editName,
            photoURL: finalPhotoURL 
          });
        } catch (e) {
          console.error("Auth profile update skipped:", e);
        }
      }
      
      setIsEditingProfile(false);
      setSelectedFile(null);
      setPreviewURL(null);
      await logActivity({
        type: 'user',
        user: { name: editName },
        action: `Updated profile details`,
        details: `Name changed to ${editName}`,
        status: 'INFO'
      });
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
          const resRef = doc(db, 'reservations', id);
          const resSnap = await getDoc(resRef);
          const resData = resSnap.data();
          await deleteDoc(resRef);
          await logActivity({
            type: 'user',
            user: { name: auth.currentUser?.displayName || 'Member' },
            action: `Cancelled reservation`,
            details: `Book ID: ${resData?.bookId}`,
            status: 'WARNING'
          });
          toast.success('Reservation cancelled.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `reservations/${id}`);
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="absolute inset-0 bg-primary-accent/20 blur-xl animate-pulse rounded-full"></div>
          <Loader2 className="h-10 w-10 text-primary-accent animate-spin relative z-10" />
        </div>
        <p className="mt-8 text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Syncing User Profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">My Dashboard</h1>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mt-2">Manage your current loans and active reservations.</p>
        </div>
        
        {profile && (
          <div className="glass-panel rounded-3xl p-6 flex items-center gap-6 shadow-2xl">
            <div className="relative group">
              <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-accent font-bold overflow-hidden shadow-inner">
                {profile.photoURL ? (
                  <img src={previewURL || profile.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  previewURL ? (
                    <img src={previewURL} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon size={28} />
                  )
                )}
              </div>
              <input 
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setPreviewURL(URL.createObjectURL(file));
                    setIsEditingProfile(true);
                  }
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-1.5 bg-primary-accent text-white rounded-lg shadow-xl border-2 border-bg-dark hover:scale-110 transition-all"
              >
                <Camera size={12} />
              </button>
            </div>
            {isEditingProfile ? (
              <div className="flex flex-col gap-2 min-w-[200px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update Profile</span>
                  <div className="flex gap-1">
                    <button onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile} className="p-1 text-slate-500 hover:text-rose-500 transition-colors">
                      <X size={16} />
                    </button>
                    <button onClick={handleUpdateProfile} disabled={isSavingProfile} className="p-1 text-primary-accent hover:text-white transition-colors">
                      {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                  </div>
                </div>
                <input 
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-primary-accent outline-none w-full"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Full Name"
                />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black text-white tracking-tight">{profile.name}</p>
                    {profile.isPro && <Sparkles size={16} className="text-amber-400 fill-amber-400" />}
                  </div>
                  <p className="text-[10px] text-primary-accent uppercase font-black tracking-widest">{profile.role} MEMBER</p>
                </div>
                <button onClick={() => setIsEditingProfile(true)} className="p-2.5 text-slate-500 hover:text-primary-accent hover:bg-primary-accent/10 rounded-xl transition-all">
                  <Edit2 size={18} />
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                  <AlertCircle size={24} className="text-amber-400" />
                  Live Sync status
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
                      className={`rounded-2xl p-6 flex items-center justify-between transition-all border shadow-2xl backdrop-blur-3xl ${
                        isHighPriority 
                          ? 'bg-primary-accent/10 border-primary-accent/20 shadow-primary-accent/5' 
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isHighPriority ? 'bg-primary-accent/10 text-primary-accent' : 'bg-amber-400/10 text-amber-500'
                        }`}>
                          <BookOpen size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            {isHighPriority && (
                              <span className="text-[10px] uppercase font-black bg-primary-accent text-white px-1.5 py-0.5 rounded-md tracking-widest">
                                URGENT
                              </span>
                            )}
                            <p className="text-sm font-bold text-white">
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
                      <div className="flex items-center gap-4 ml-6">
                        {notif.canOneClickBorrow && (
                          <button 
                            onClick={() => handleOneClickBorrow(notif)}
                            className="flex items-center gap-2.5 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl bg-primary-accent text-white hover:bg-primary-accent/90 active:scale-95 shadow-primary-accent/20"
                          >
                            <ShoppingBag size={14} />
                            Borrow Now
                          </button>
                        )}
                        <button 
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
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
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                <BookOpen size={24} className="text-secondary-accent" />
                Active Loans
              </h2>
              <span className="bg-secondary-accent/10 text-secondary-accent text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border border-secondary-accent/20">
                {borrowedBooks.length} BOOKS
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
                        className={`glass-panel rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all border ${
                          isOverdue ? 'border-rose-500/30 bg-rose-500/5 shadow-rose-500/5' : 'border-white/5 hover:border-white/10'
                        }`}
                      >
                          <div className="flex items-center gap-6">
                            <div className="h-20 w-16 bg-white/5 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 shadow-2xl relative group">
                              {item.bookCover ? (
                                <img src={item.bookCover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-slate-700">
                                  <BookOpen size={24} />
                                </div>
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-white uppercase tracking-tighter">{item.bookTitle || `CORE ASSET: ${item.bookId}`}</h3>
                              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                                <div className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  <Calendar size={14} className="mr-2 text-primary-accent" />
                                  ISSUED {new Date(item.issueDate).toLocaleDateString('en-GB')}
                                </div>
                                <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                                  <Clock size={14} className="mr-2" />
                                  SYNC DUE: {new Date(item.dueDate).toLocaleDateString('en-GB')}
                                  {isOverdue && <span className="ml-3 text-[8px] uppercase font-black bg-rose-500 text-white px-2 py-0.5 rounded shadow-lg animate-pulse">OVERDUE</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                        <div className="flex items-center gap-2">
                          {fine > 0 && (
                            <div className="mr-6 text-right">
                              <p className="text-[10px] text-slate-600 uppercase font-black tracking-[0.2em] mb-1">Accumulated Fine</p>
                              <p className="text-xl font-black text-rose-500 tracking-tighter">₹{fine.toLocaleString('en-IN')}</p>
                            </div>
                          )}
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleRenew(item.id, item.dueDate)}
                              disabled={isRenewing === item.id || isOverdue}
                              className="flex items-center justify-center gap-2 px-5 py-3 glass-panel text-white/70 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-30 transition-all border border-white/10"
                            >
                              {isRenewing === item.id ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                              Renew
                            </button>
                            <button
                              onClick={() => handleReturn(item)}
                              disabled={isReturning === item.id}
                              className="flex items-center justify-center gap-2 px-5 py-3 bg-white/5 text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 transition-all border border-white/5"
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
                <div className="glass-panel border-dashed border-white/10 rounded-[2rem] py-16 flex flex-col items-center justify-center text-center">
                  <div className="bg-white/5 p-4 rounded-2xl mb-4 text-slate-500">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-white font-black uppercase tracking-tight">No active loans</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest max-w-xs mt-2">Explore the digital archives and find your next read.</p>
                </div>
              )}
            </AnimatePresence>
          </section>

          {/* Reservations Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                <Bookmark size={24} className="text-primary-accent" />
                Active Reservations
              </h2>
              <span className="bg-amber-400/10 text-amber-500 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border border-amber-400/20">
                {reservations.length} Pending
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reservations.length > 0 ? (
                reservations.map((res) => (
                  <div key={res.id} className="glass-panel border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-xl group hover:border-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-10 bg-white/5 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                        {res.bookCover ? (
                          <img src={res.bookCover} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-500">
                            <Bookmark size={14} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight line-clamp-1">{res.bookTitle || `Book ID: ${res.bookId}`}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Reserved {new Date(res.reservationDate).toLocaleDateString()}</p>
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
                <div className="sm:col-span-2 glass-panel border-white/5 border-dashed rounded-3xl py-12 flex flex-col items-center justify-center text-center opacity-40">
                  <Bookmark size={32} className="text-slate-600 mb-4" />
                  <p className="text-slate-600 font-black uppercase tracking-[0.2em] text-[10px]">No active reservations trace found in current sync.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <div className="glass-panel border-white/5 rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6">Account Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-lg uppercase border border-emerald-400/20">Active</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Fines</span>
                <span className="text-sm font-black text-rose-500">₹{totalFines.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Limit</span>
                <span className="text-sm font-black text-white uppercase tracking-tight">{profile.isPro ? 'Unlimited' : '5 Books'}</span>
              </div>
            </div>
          </div>

          <div className={`p-8 rounded-[2rem] shadow-2xl transition-all relative overflow-hidden group ${profile?.isPro ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-gradient-to-br from-primary-accent to-secondary-accent'}`}>
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
              <Sparkles size={120} />
            </div>
            <h3 className="font-black text-xl text-white uppercase tracking-tighter mb-3 flex items-center gap-3 relative z-10">
              {profile?.isPro ? <><Sparkles size={24} className="fill-white" /> Pro Member</> : 'Lumina Pro'}
            </h3>
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest leading-relaxed mb-8 relative z-10">
              {profile?.isPro 
                ? 'You are enjoying unlimited borrowing and priority services across all library branches.' 
                : 'Experience the ultimate library membership with home delivery and priority reservations.'}
            </p>
            {!profile?.isPro && (
              <button 
                onClick={handleUpgrade}
                className="w-full py-4 bg-white text-primary-accent rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:scale-[1.02] transition-all active:scale-95 shadow-xl relative z-10"
              >
                Access Pro Status
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
