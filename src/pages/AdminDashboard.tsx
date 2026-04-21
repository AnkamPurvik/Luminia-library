import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc, where, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, logActivity } from '../lib/firebase';
import { Book } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Edit2, Trash2, Loader2, 
  Package, BookOpen, Users, AlertCircle, TrendingUp,
  X, Save, Hash, Tag, Type, Image as ImageIcon, Sparkles,
  History, RotateCcw, Shield, Activity, Calendar, Clock, ArrowRight,
  CheckCircle2, MessageCircle
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { AdminSupportInbox } from '../components/ui/AdminSupportInbox';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [membersCount, setMembersCount] = useState(0);
  const [totalFines, setTotalFines] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'users' | 'support'>('inventory');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [isModifyingDeadline, setIsModifyingDeadline] = useState<string | null>(null);
  const [newDeadline, setNewDeadline] = useState('');
  const [isbnLookup, setIsbnLookup] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
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

  // Form State
  const [formData, setFormData] = useState<Partial<Book>>({
    title: '',
    author: '',
    isbn: '',
    genre: '',
    totalCopies: 1,
    availableCopies: 1,
    description: '',
    coverUrl: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'books'));
    const unsubscribeBooks = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Book[];
      setBooks(booksData);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'books');
      setIsLoading(false);
    });

    // Fetch real-time stats for members
    const unsubscribeMembers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setMembersCount(snapshot.size);
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(membersData);
    });

    // Fetch real-time stats for fines
    const unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const fines = snapshot.docs.reduce((acc, doc) => acc + (doc.data().fineAmount || 0), 0);
      setTotalFines(fines);
    });

    return () => {
      unsubscribeBooks();
      unsubscribeMembers();
      unsubscribeTransactions();
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'chat_sessions'), where('status', '==', 'open'));
    const unsubscribeSupport = onSnapshot(q, (snapshot) => {
      const unread = snapshot.docs.reduce((acc, doc) => acc + (doc.data().unreadByAdmin || 0), 0);
      setTotalUnread(unread);
    });
    return () => unsubscribeSupport();
  }, []);

  const handleOpenModal = (book?: Book) => {
    if (book) {
      setEditingBook(book);
      setFormData(book);
    } else {
      setEditingBook(null);
      setFormData({
        title: '',
        author: '',
        isbn: '',
        genre: '',
        totalCopies: 1,
        availableCopies: 1,
        description: '',
        coverUrl: ''
      });
    }
    setIsModalOpen(true);
    setIsbnLookup('');
  };

  const fetchBookDetails = async () => {
    const cleanIsbn = isbnLookup.replace(/[-\s]/g, '');
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
      toast.error('Please enter a valid 10 or 13-digit ISBN');
      return;
    }

    setIsFetching(true);
    try {
      // 1. Try Google Books API
      const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const googleData = await googleRes.json();

      let bookInfo: Partial<Book> = {};

      if (googleData.totalItems > 0) {
        const item = googleData.items[0].volumeInfo;
        const volumeId = googleData.items[0].id;
        
        // 1. Prioritize Open Library High-Res Cover (often better than Google thumbnails)
        // 2. Construct high-quality Google Books URL as secondary
        // 3. Use provided imageLinks as tertiary
        
        const olCoverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
        const googleHighResUrl = `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&zoom=3&source=gbs_api`;
        
        let coverUrl = googleHighResUrl; // Start with high-res construction

        if (item.imageLinks) {
          const links = item.imageLinks;
          // If Google provides explicit high-res links, use those
          const bestGoogleLink = links.extraLarge || links.large || links.medium;
          if (bestGoogleLink) {
            coverUrl = bestGoogleLink;
          }
        }

        // Clean up URL
        coverUrl = coverUrl.replace('http:', 'https:').replace('&edge=curl', '');

        bookInfo = {
          title: item.title || '',
          author: item.authors ? item.authors[0] : '',
          genre: item.categories ? item.categories[0] : '',
          description: item.description || '',
          coverUrl: coverUrl,
          isbn: cleanIsbn
        };
      } else {
        // 2. Fallback to Open Library API
        const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
        const olData = await olRes.json();
        const key = `ISBN:${cleanIsbn}`;

        if (olData[key]) {
          const item = olData[key];
          bookInfo = {
            title: item.title || '',
            author: item.authors ? item.authors[0].name : '',
            genre: item.subjects ? item.subjects[0].name : '',
            description: item.notes || (item.excerpts ? item.excerpts[0].text : ''),
            coverUrl: `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
            isbn: cleanIsbn
          };
        }
      }

      if (Object.keys(bookInfo).length > 0) {
        const hasExistingData = formData.title || formData.author || formData.description;
        
        const applyData = () => {
          setFormData(prev => ({
            ...prev,
            ...bookInfo,
            isbn: cleanIsbn // Always update ISBN to the one fetched
          }));
          toast.success('Book details fetched!');
        };

        if (hasExistingData) {
          if (window.confirm('This will overwrite currently entered data. Continue?')) {
            applyData();
          }
        } else {
          applyData();
        }
      } else {
        toast.error('Book details not found. Please enter manually.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to fetch book details.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBook) {
        await updateDoc(doc(db, 'books', editingBook.id), formData);
        await logActivity({
          type: 'admin',
          user: { name: auth.currentUser?.displayName || 'Admin' },
          action: `Updated book: ${formData.title}`,
          details: `ISBN: ${formData.isbn}`,
          status: 'INFO'
        });
        toast.success('Book updated successfully!');
      } else {
        await addDoc(collection(db, 'books'), formData);
        await logActivity({
          type: 'admin',
          user: { name: auth.currentUser?.displayName || 'Admin' },
          action: `Added new book: ${formData.title}`,
          details: `Author: ${formData.author}`,
          status: 'SUCCESS'
        });
        toast.success('Book added successfully!');
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'books');
    }
  };

  const handleDelete = (id: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Book',
      message: 'Are you sure you want to delete this book? This action cannot be undone and will affect current loans.',
      type: 'danger',
      confirmLabel: 'Delete Permanently',
      onConfirm: async () => {
        try {
          const bookSnap = await getDoc(doc(db, 'books', id));
          const bookData = bookSnap.data();
          await deleteDoc(doc(db, 'books', id));
          await logActivity({
            type: 'admin',
            user: { name: auth.currentUser?.displayName || 'Admin' },
            action: `Deleted book: ${bookData?.title || id}`,
            details: `Book ID: ${id}`,
            status: 'WARNING'
          });
          toast.success('Book deleted successfully');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `books/${id}`);
        }
      }
    });
  };



  const handleUpdateUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      await logActivity({
        type: 'admin',
        user: { name: auth.currentUser?.displayName || 'Admin' },
        action: `Changed user role`,
        details: `User ID: ${userId} -> ${newRole.toUpperCase()}`,
        status: 'INFO'
      });
      toast.success(`User role updated to ${newRole}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleTogglePro = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isPro: !currentStatus });
      await logActivity({
        type: 'admin',
        user: { name: auth.currentUser?.displayName || 'Admin' },
        action: `Toggled user Pro status`,
        details: `User ID: ${userId} -> ${!currentStatus ? 'PRO' : 'MEMBER'}`,
        status: 'INFO'
      });
      toast.success(`User pro status updated`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete User Account',
      message: `Are you sure you want to delete ${userName}'s account? This will remove all their library data.`,
      type: 'danger',
      confirmLabel: 'Delete Account',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          await logActivity({
            type: 'admin',
            user: { name: auth.currentUser?.displayName || 'Admin' },
            action: `Deleted user account`,
            details: `Email: ${userName}`,
            status: 'WARNING'
          });
          toast.success('User account deleted');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
        }
      }
    });
  };

  const handleFetchUserHistory = (user: any) => {
    setSelectedUser(user);
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.id)
    );
    
    // Set up real-time listener for this user's transactions
    return onSnapshot(q, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserTransactions(transData);
    });
  };

  const handleAdminReturn = async (transaction: any) => {
    const tId = transaction.id;
    const bId = transaction.bookId || transaction.bookid; // Support variations

    if (!tId || !bId) {
      toast.error('Missing core IDs for return action');
      return;
    }

    try {
      await updateDoc(doc(db, 'transactions', tId), {
        status: 'returned',
        returned_at: new Date().toISOString(),
        returnDate: new Date().toISOString()
      });

      const bookRef = doc(db, 'books', bId);
      const bookSnap = await getDoc(bookRef);
      if (bookSnap.exists()) {
        const bookData = bookSnap.data();
        await updateDoc(bookRef, {
          availableCopies: Math.min((bookData.availableCopies || 0) + 1, bookData.totalCopies || 100)
        });
        await logActivity({
          type: 'admin',
          user: { name: auth.currentUser?.displayName || 'Admin' },
          action: `Forced return: ${bookData.title}`,
          details: `Transaction ID: ${tId}`,
          status: 'SUCCESS'
        });
      }
      toast.success('Book successfully returned');
    } catch (err: any) {
      console.error('Force Return Error:', err);
      toast.error(`Return failed: ${err.message}`);
    }
  };

  const handleWaiverFine = async (transactionId: string) => {
    try {
      await updateDoc(doc(db, 'transactions', transactionId), {
        fineAmount: 0
      });
      toast.success('Fine waived successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${transactionId}`);
    }
  };

  const calculateFine = (dueDateString: string) => {
    const dueDate = new Date(dueDateString);
    const today = new Date();
    if (today > dueDate) {
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays * 10;
    }
    return 0;
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.isbn.includes(searchQuery) ||
    book.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { label: 'Total Titles', value: books.length, icon: Package, color: 'bg-blue-500' },
    { label: 'Total Copies', value: books.reduce((acc, b) => acc + b.totalCopies, 0), icon: BookOpen, color: 'bg-indigo-500' },
    { label: 'Active Members', value: membersCount, icon: Users, color: 'bg-emerald-500' },
    { label: 'Support Queue', value: totalUnread, icon: MessageCircle, color: 'bg-rose-500' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="absolute inset-0 bg-primary-accent/20 blur-xl animate-pulse rounded-full"></div>
          <Loader2 className="h-10 w-10 text-primary-accent animate-spin relative z-10" />
        </div>
        <p className="mt-6 text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Loading Library System...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-tight">Admin Console</h1>
          <div className="flex items-center gap-4 mt-3">
             <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Library Management / Dashboard</p>
             <div className="h-4 w-px bg-white/10" />
             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-black uppercase border border-emerald-500/20">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Live Status Active
             </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/admin/timeline')}
            className="inline-flex items-center px-6 py-4 bg-white/5 border border-white/10 text-slate-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 hover:text-white transition-all shadow-xl active:scale-95 group"
          >
            <Activity size={16} className="mr-3 text-primary-accent group-hover:scale-110 transition-transform" />
            Activity Log
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center px-8 py-4 bg-primary-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary-accent/90 transition-all shadow-xl shadow-primary-accent/20 active:scale-95 border border-primary-accent/50 group"
          >
            <Plus size={18} className="mr-3 group-hover:rotate-90 transition-transform" />
            Add New Book
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => stat.label === 'Active Members' && setActiveTab('users')}
            className={`p-8 rounded-[2rem] transition-all flex flex-col justify-between cursor-pointer group ${
              (stat.label === 'Active Members' && activeTab === 'users') 
                ? 'bg-primary-accent/10 border-2 border-primary-accent shadow-2xl shadow-primary-accent/20' 
                : 'glass-panel hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className={`${stat.color} p-3 rounded-xl text-white group-hover:scale-110 transition-transform shadow-lg`}>
                <stat.icon size={20} />
              </div>
              <TrendingUp size={16} className="text-primary-accent" />
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</p>
              <p className="text-3xl font-black text-white mt-2 tracking-tighter">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-8 border-b border-white/5">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${
            activeTab === 'inventory' ? 'text-primary-accent' : 'text-slate-500 hover:text-white'
          }`}
        >
          Book Inventory
          {activeTab === 'inventory' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-accent rounded-full shadow-[0_0_10px_rgba(79,70,229,0.8)]" />}
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${
            activeTab === 'users' ? 'text-primary-accent' : 'text-slate-500 hover:text-white'
          }`}
        >
          Member Control
          {activeTab === 'users' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-accent rounded-full shadow-[0_0_10px_rgba(79,70,229,0.8)]" />}
        </button>
        <button 
          onClick={() => setActiveTab('support')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${
            activeTab === 'support' ? 'text-primary-accent' : 'text-slate-500 hover:text-white'
          }`}
        >
          Support Inbox
          {activeTab === 'support' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-accent rounded-full shadow-[0_0_10px_rgba(79,70,229,0.8)]" />}
        </button>
      </div>

      {activeTab === 'inventory' ? (
        /* Inventory Table */
        <div className="glass-panel border-white/5 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/5">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Book Collection</h2>
          <div className="relative max-w-xs w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-accent transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search catalog..."
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold tracking-widest uppercase text-white focus:outline-none focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black border-b border-white/5">
                <th className="px-6 py-5">Book Details</th>
                <th className="px-6 py-5">ISBN</th>
                <th className="px-6 py-5">Category</th>
                <th className="px-6 py-5">Stock Status</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredBooks.map((book) => (
                <tr key={book.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-6 py-6 transition-all group-hover:pl-8">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-10 bg-white/5 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 shadow-lg">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-700">
                            <BookOpen size={18} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-black text-white text-sm tracking-tight line-clamp-1 uppercase">{book.title}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{book.author}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-[10px] text-slate-400 font-mono tracking-widest">{book.isbn}</td>
                  <td className="px-6 py-6">
                    <span className="px-3 py-1.5 bg-white/5 text-primary-accent border border-primary-accent/20 rounded-lg text-[10px] font-black uppercase tracking-widest">
                      {book.genre}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col gap-2">
                      <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                        <div 
                          className="h-full bg-primary-accent rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                          style={{ width: `${book.totalCopies > 0 ? (book.availableCopies / book.totalCopies) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                        {book.availableCopies} / {book.totalCopies} READY
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => navigate(`/admin/book/${book.id}`)}
                        className="p-2.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                        title="View Movement History Audit"
                      >
                         <Clock size={16} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(book)}
                        className="p-2.5 text-slate-500 hover:text-primary-accent hover:bg-primary-accent/5 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(book.id)}
                        className="p-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      ) : activeTab === 'users' ? (
        /* User Management Table */
        <div className="glass-panel border-white/5 rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/5">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Member Directory</h2>
            <div className="relative max-w-xs w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-accent transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search members..."
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold tracking-widest uppercase text-white focus:outline-none focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black border-b border-white/5">
                  <th className="px-8 py-5">Member Profile</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Account Role</th>
                  <th className="px-8 py-5">Established</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                      <div className="h-14 w-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-primary-accent font-black uppercase text-xs relative shadow-inner">
                        {user.name?.charAt(0) || <Users size={20} />}
                        {user.isPro && (
                          <div className="absolute -top-2 -right-2 bg-amber-400 text-bg-dark p-1 rounded-lg border-2 border-bg-dark shadow-xl">
                            <Sparkles size={10} className="fill-bg-dark" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-white text-sm tracking-tight uppercase">{user.name}</p>
                          {user.isPro && <span className="text-[8px] font-black bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-widest border border-amber-400/20">PRO</span>}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{user.email}</p>
                      </div>
                    </div>
                  </td>
                    <td className="px-8 py-6">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                        user.membershipStatus === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20' : 'bg-rose-500/10 text-rose-400 border border-rose-400/20'
                      }`}>
                        {user.membershipStatus || 'active'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        user.role === 'admin' ? 'bg-primary-accent text-white shadow-lg shadow-primary-accent/20' : 'bg-white/5 text-slate-400 border border-white/5'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-[10px] text-slate-500 font-black tracking-widest uppercase">
                      {new Date(user.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                         <button 
                          onClick={() => handleFetchUserHistory(user)}
                          className="p-2.5 text-slate-500 hover:text-primary-accent hover:bg-white/5 rounded-xl transition-all"
                          title="Manage User & History"
                        >
                          <Activity size={18} />
                        </button>
                        {(user.role !== 'admin' || auth.currentUser?.email === 'purvik.ankam@gmail.com') && (
                          <button 
                            onClick={() => handleUpdateUserRole(user.id, user.role)}
                            className="px-4 py-2 text-[9px] font-black uppercase tracking-tighter text-secondary-accent hover:bg-secondary-accent/10 rounded-xl transition-all border border-secondary-accent/20"
                          >
                            UPGRADE
                          </button>
                        )}
                        <button 
                          onClick={() => handleTogglePro(user.id, !!user.isPro)}
                          className={`px-4 py-2 text-[9px] font-black uppercase tracking-tighter rounded-xl transition-all border ${
                            user.isPro ? 'bg-amber-400/10 text-amber-400 border-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'text-slate-500 hover:bg-white/5 border-white/10'
                          }`}
                        >
                          {user.isPro ? 'REVOKE PRO' : 'GRANT PRO'}
                        </button>
                        {(user.role !== 'admin' || auth.currentUser?.email === 'purvik.ankam@gmail.com') && auth.currentUser?.uid !== user.id && (
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            className="p-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm italic">
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Support Inbox Tab */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AdminSupportInbox />
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-2xl bg-surface-dark border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                  {editingBook ? 'Update Book' : 'Add New Book'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-xl border border-white/5">
                  <X size={20} />
                </button>
              </div>

              {/* ISBN Quick Phil Header */}
              {!editingBook && (
                <div className="bg-primary-accent/5 p-10 border-b border-white/5">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-primary-accent tracking-[0.3em] flex items-center gap-3">
                       <Sparkles size={16} /> Book Details via ISBN
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-600">
                          <Hash size={16} />
                        </div>
                        <input 
                          placeholder="ENTER ISBN-10 OR ISBN-13..."
                          className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 outline-none font-black text-[11px] uppercase tracking-widest text-white transition-all shadow-inner"
                          value={isbnLookup}
                          onChange={e => setIsbnLookup(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), fetchBookDetails())}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={fetchBookDetails}
                        disabled={isFetching || !isbnLookup}
                        className="px-8 py-4 bg-primary-accent text-white rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-primary-accent/80 disabled:opacity-30 transition-all shadow-xl shadow-primary-accent/20 flex items-center gap-3 active:scale-95 whitespace-nowrap"
                      >
                        {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Fetch Details
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-accent" />
                      SYSTEM WILL AUTOPULL METADATA FROM GLOBAL COLLECTIONS.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-surface-dark">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Book Title</label>
                    <input 
                      required
                      placeholder="BOOK TITLE"
                      className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase tracking-tight"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Author</label>
                    <input 
                      required
                      placeholder="AUTHOR NAME"
                      className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase"
                      value={formData.author}
                      onChange={e => setFormData({...formData, author: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">ISBN</label>
                    <input 
                      required
                      placeholder="ISBN"
                      className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase"
                      value={formData.isbn}
                      onChange={e => setFormData({...formData, isbn: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Genre</label>
                    <input 
                      required
                      placeholder="GENRE"
                      className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase"
                      value={formData.genre}
                      onChange={e => setFormData({...formData, genre: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Total Copies</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase"
                      value={isNaN(formData.totalCopies as number) ? '' : formData.totalCopies}
                      onChange={e => setFormData({...formData, totalCopies: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Available Copies</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase"
                      value={isNaN(formData.availableCopies as number) ? '' : formData.availableCopies}
                      onChange={e => setFormData({...formData, availableCopies: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Cover Image URL</label>
                  <div className="flex gap-4">
                    <input 
                      className="flex-grow px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs"
                      value={formData.coverUrl}
                      placeholder="https://example.com/cover.jpg"
                      onChange={e => setFormData({...formData, coverUrl: e.target.value})}
                    />
                    {formData.coverUrl && (
                      <div className="h-14 w-10 bg-white/5 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 shadow-2xl">
                        <img 
                          src={formData.coverUrl} 
                          alt="Preview" 
                          className="h-full w-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150?text=Error')}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase resize-none"
                    placeholder="ENTER ASSET DESCRIPTION..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="pt-8 flex gap-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-white/5 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-white/10 transition-all border border-white/5"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-primary-accent text-white rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-primary-accent/90 shadow-2xl shadow-primary-accent/30 transition-all active:scale-[0.98] border border-primary-accent/50"
                  >
                    <Save size={18} className="inline mr-2" />
                    {editingBook ? 'Save Changes' : 'Add Book'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Manage Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedUser(null);
                setIsModifyingDeadline(null);
                setNewDeadline('');
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-4xl bg-surface-dark border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-6">
                   <div className="h-16 w-16 bg-primary-accent/10 border border-primary-accent/20 rounded-2xl flex items-center justify-center text-primary-accent font-black text-2xl shadow-inner">
                    {selectedUser.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedUser.name}</h3>
                      {selectedUser.isPro && <Sparkles size={18} className="text-amber-400 fill-amber-400 animate-pulse" />}
                    </div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">{selectedUser.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    setIsModifyingDeadline(null);
                    setNewDeadline('');
                  }} 
                  className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2.5 rounded-xl border border-white/5"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-12 custom-scrollbar bg-bg-dark">
                {/* Active Loans Section */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-black text-white flex items-center gap-3 uppercase tracking-[0.2em] text-[10px]">
                      <div className="w-2 h-2 rounded-full bg-primary-accent shadow-[0_0_8px_rgba(79,70,229,0.8)]" />
                      Currently Borrowed Books
                    </h4>
                    <span className="bg-primary-accent/10 text-primary-accent text-[9px] font-black px-3 py-1 rounded-lg border border-primary-accent/20 uppercase tracking-widest">
                      {userTransactions.filter(t => t.status === 'borrowed' || t.status === 'overdue').length} BOOKS OUT
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {userTransactions.filter(t => t.status === 'borrowed' || t.status === 'overdue').map(t => {
                      const fine = calculateFine(t.dueDate);
                      return (
                        <div key={t.id} className="glass-panel border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:bg-white/[0.08] transition-all">
                          <div className="flex items-center gap-4">
                            <div className="h-16 w-12 bg-white/5 rounded-lg shadow-2xl overflow-hidden flex-shrink-0 border border-white/10">
                              <img src={t.bookCover} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-white line-clamp-1 uppercase tracking-tight">{t.bookTitle}</p>
                              <p className="text-[9px] text-slate-500 font-black uppercase mt-1 tracking-widest">DUE DATE: {new Date(t.dueDate).toLocaleDateString('en-GB')}</p>
                              {fine > 0 && <p className="text-[9px] text-rose-500 font-black uppercase mt-1 animate-pulse tracking-widest">PENALTY: ₹{fine}</p>}
                              {isModifyingDeadline === t.id ? (
                                <div className="mt-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
                                  <input 
                                    type="date" 
                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-primary-accent/40"
                                    value={newDeadline}
                                    onChange={(e) => setNewDeadline(e.target.value)}
                                  />
                                  <button 
                                    onClick={async () => {
                                      if (!newDeadline) return;
                                      try {
                                        const dateObj = new Date(newDeadline);
                                        const updatedDate = dateObj.toISOString();
                                        
                                        await updateDoc(doc(db, 'transactions', t.id), {
                                          dueDate: updatedDate,
                                          updated_due_date: updatedDate,
                                          original_due_date: t.dueDate
                                        });

                                        // Automated Notification
                                        await addDoc(collection(db, 'notifications'), {
                                          userId: selectedUser.id,
                                          message: `Schedule Updated: The return date for "${t.bookTitle}" has been moved to ${dateObj.toLocaleDateString('en-GB')}.`,
                                          type: 'update',
                                          read: false,
                                          createdAt: new Date().toISOString()
                                        });

                                        await logActivity({
                                          type: 'admin',
                                          user: { name: auth.currentUser?.displayName || 'Admin' },
                                          action: `Modified deadline: ${t.bookTitle}`,
                                          details: `User: ${selectedUser.name} | New Date: ${newDeadline}`,
                                          status: 'INFO'
                                        });

                                        toast.success('Deadline updated and user notified');
                                        setIsModifyingDeadline(null);
                                      } catch (err) {
                                        toast.error('Failed to update deadline');
                                      }
                                    }}
                                    className="bg-emerald-500 text-white p-1 rounded-lg hover:bg-emerald-600 transition-colors"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button 
                                    onClick={() => setIsModifyingDeadline(null)}
                                    className="bg-white/5 text-slate-500 p-1 rounded-lg hover:text-white transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setIsModifyingDeadline(t.id);
                                    setNewDeadline(t.dueDate.split('T')[0]);
                                  }}
                                  className="mt-2 flex items-center gap-1.5 text-[9px] font-black uppercase text-primary-accent hover:text-white transition-colors group"
                                >
                                  <Calendar size={10} className="group-hover:scale-110 transition-transform" />
                                  Modify Deadline
                                </button>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleAdminReturn(t)}
                            className="bg-primary-accent/10 text-primary-accent p-3 rounded-xl hover:bg-primary-accent hover:text-white transition-all border border-primary-accent/20 active:scale-95 touch-target"
                            title="Return Book"
                          >
                            <RotateCcw size={18} />
                          </button>
                        </div>
                      );
                    })}
                    {userTransactions.filter(t => t.status === 'borrowed' || t.status === 'overdue').length === 0 && (
                      <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.02]">
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] italic">No active loans found for this member.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Borrowing History Section */}
                <section>
                  <h4 className="font-black text-white flex items-center gap-3 uppercase tracking-[0.2em] text-[10px] mb-6">
                    <History size={16} className="text-slate-600" />
                    Borrowing History
                  </h4>
                  <div className="glass-panel border-white/5 rounded-[2rem] overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white/[0.03] text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">
                          <th className="px-8 py-5">Book Title</th>
                          <th className="px-8 py-5">Loan Period</th>
                          <th className="px-8 py-5">Overheads</th>
                          <th className="px-8 py-5 text-right">History Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {userTransactions.filter(t => t.status === 'returned').slice(0, 10).map(t => (
                          <tr key={t.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-8 py-5 font-black text-white text-[11px] uppercase tracking-tight">{t.bookTitle}</td>
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">BORROWED {new Date(t.issueDate).toLocaleDateString('en-GB')}</span>
                                <span className="text-[9px] text-secondary-accent font-black uppercase tracking-widest mt-1">RETURNED {new Date(t.returnDate).toLocaleDateString('en-GB')}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              {t.fineAmount > 0 ? (
                                <span className="text-rose-500 font-black text-[11px]">₹{t.fineAmount}</span>
                              ) : (
                                <span className="text-emerald-500/50 font-black">---</span>
                              )}
                            </td>
                            <td className="px-8 py-5 text-right">
                              {t.fineAmount > 0 && (
                                <button 
                                  onClick={() => handleWaiverFine(t.id)}
                                  className="text-[9px] font-black uppercase tracking-widest text-primary-accent hover:text-white transition-colors"
                                >
                                  Waive Fine
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="p-10 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] mb-2">Account Type</span>
                    <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                       <Shield size={14} className="text-primary-accent" />
                       Level / {selectedUser.membershipStatus || 'active'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-[9px] font-black uppercase text-slate-600 tracking-[0.2em] hidden sm:block">Secure Admin Session Active</span>
                  <button 
                    onClick={() => {
                      setSelectedUser(null);
                      setIsModifyingDeadline(null);
                      setNewDeadline('');
                    }}
                    className="px-8 py-4 bg-primary-accent text-white rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-primary-accent/80 transition-all shadow-xl shadow-primary-accent/20"
                  >
                    Close Profile
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
