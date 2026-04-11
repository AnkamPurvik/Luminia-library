import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc, where, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Book } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Edit2, Trash2, Loader2, 
  Package, BookOpen, Users, AlertCircle, TrendingUp,
  X, Save, Hash, Tag, Type, Image as ImageIcon, Sparkles,
  History, RotateCcw, Shield, Activity, Calendar, Clock, ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
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
  const [activeTab, setActiveTab] = useState<'inventory' | 'users'>('inventory');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [isbnLookup, setIsbnLookup] = useState('');
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
        toast.success('Book updated successfully!');
      } else {
        await addDoc(collection(db, 'books'), formData);
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
          await deleteDoc(doc(db, 'books', id));
          toast.success('Book deleted successfully');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `books/${id}`);
        }
      }
    });
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.isbn.includes(searchQuery)
  );

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleTogglePro = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isPro: !currentStatus });
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

  const stats = [
    { label: 'Total Titles', value: books.length, icon: Package, color: 'bg-blue-500' },
    { label: 'Total Copies', value: books.reduce((acc, b) => acc + b.totalCopies, 0), icon: BookOpen, color: 'bg-indigo-500' },
    { label: 'Active Members', value: membersCount, icon: Users, color: 'bg-emerald-500' },
    { label: 'Overdue Fines', value: `₹${totalFines.toLocaleString('en-IN')}`, icon: AlertCircle, color: 'bg-rose-500' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-display">Admin Console</h1>
          <p className="text-slate-500 mt-1">Manage library inventory and monitor system performance.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus size={20} className="mr-2" />
          Add New Book
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => stat.label === 'Active Members' && setActiveTab('users')}
            className={`p-6 rounded-2xl border border-slate-200 shadow-sm transition-all flex flex-col justify-between cursor-pointer group ${
              (stat.label === 'Active Members' && activeTab === 'users') ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : 'bg-white hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-2 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} />
              </div>
              <TrendingUp size={16} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`pb-4 px-2 text-sm font-bold transition-all relative ${
            activeTab === 'inventory' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Books Inventory
          {activeTab === 'inventory' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 text-sm font-bold transition-all relative ${
            activeTab === 'users' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          User Management
          {activeTab === 'users' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
        </button>
      </div>

      {activeTab === 'inventory' ? (
        /* Inventory Table */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">Book Inventory</h2>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search inventory..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Book Details</th>
                <th className="px-6 py-4">ISBN</th>
                <th className="px-6 py-4">Genre</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBooks.map((book) => (
                <tr key={book.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-9 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-300">
                            <BookOpen size={16} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm line-clamp-1">{book.title}</p>
                        <p className="text-xs text-slate-500">{book.author}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{book.isbn}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                      {book.genre}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full" 
                          style={{ width: `${book.totalCopies > 0 ? (book.availableCopies / book.totalCopies) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">
                        {book.availableCopies} / {book.totalCopies} Available
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => navigate(`/admin/book/${book.id}`)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Movement History Audit"
                      >
                         <Clock size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(book)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(book.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        /* User Management Table */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-900">Registered Members</h2>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold uppercase text-xs relative">
                          {user.name?.charAt(0) || <Users size={16} />}
                          {user.isPro && (
                            <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full border-2 border-white">
                              <Sparkles size={8} className="fill-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 text-sm">{user.name}</p>
                          {user.isPro && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1 rounded uppercase tracking-tighter border border-amber-200">PRO</span>}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      user.membershipStatus === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {user.membershipStatus || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-slate-500 font-bold uppercase">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => handleFetchUserHistory(user)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Manage User & History"
                      >
                        <Activity size={18} />
                      </button>
                      {(user.role !== 'admin' || auth.currentUser?.email === 'purvik.ankam@gmail.com') && (
                        <button 
                          onClick={() => handleUpdateUserRole(user.id, user.role)}
                          className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-tight text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
                        >
                          Swap Role
                        </button>
                      )}
                      <button 
                        onClick={() => handleTogglePro(user.id, !!user.isPro)}
                        className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-tight rounded-lg transition-colors border ${
                          user.isPro ? 'bg-amber-50 text-amber-600 border-amber-100' : 'text-slate-500 hover:bg-slate-50 border-slate-100'
                        }`}
                      >
                        {user.isPro ? 'Demote Pro' : 'Make Pro'}
                      </button>
                      {(user.role !== 'admin' || auth.currentUser?.email === 'purvik.ankam@gmail.com') && auth.currentUser?.uid !== user.id && (
                        <button 
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingBook ? 'Edit Book' : 'Add New Book'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              {/* ISBN Quick Phil Header */}
              {!editingBook && (
                <div className="bg-indigo-50/50 p-6 border-b border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5 mb-2">
                       <Sparkles size={14} /> Quick Fill via ISBN
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Hash size={16} />
                        </div>
                        <input 
                          placeholder="Enter 10 or 13 digit ISBN..."
                          className="w-full pl-10 pr-4 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm transition-all shadow-sm"
                          value={isbnLookup}
                          onChange={e => setIsbnLookup(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), fetchBookDetails())}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={fetchBookDetails}
                        disabled={isFetching || !isbnLookup}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95 whitespace-nowrap"
                      >
                        {isFetching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        Fetch Details
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium italic">
                      Type the ISBN and hit Fetch to auto-populate book details instantly.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Type size={12} /> Title
                    </label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Users size={12} /> Author
                    </label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.author}
                      onChange={e => setFormData({...formData, author: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Hash size={12} /> ISBN
                    </label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.isbn}
                      onChange={e => setFormData({...formData, isbn: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Tag size={12} /> Genre
                    </label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.genre}
                      onChange={e => setFormData({...formData, genre: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Total Copies</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={isNaN(formData.totalCopies as number) ? '' : formData.totalCopies}
                      onChange={e => setFormData({...formData, totalCopies: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Available Copies</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={isNaN(formData.availableCopies as number) ? '' : formData.availableCopies}
                      onChange={e => setFormData({...formData, availableCopies: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <ImageIcon size={12} /> Cover Image URL
                  </label>
                  <div className="flex gap-4">
                    <input 
                      className="flex-grow px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.coverUrl}
                      placeholder="https://example.com/cover.jpg"
                      onChange={e => setFormData({...formData, coverUrl: e.target.value})}
                    />
                    {formData.coverUrl && (
                      <div className="h-10 w-8 bg-slate-100 rounded overflow-hidden flex-shrink-0 border border-slate-200">
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

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                  >
                    <Save size={20} className="inline mr-2" />
                    {editingBook ? 'Update Book' : 'Save Book'}
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
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-xl">
                    {selectedUser.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">{selectedUser.name}</h3>
                      {selectedUser.isPro && <Sparkles size={16} className="text-amber-500 fill-amber-500" />}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
                {/* Active Loans Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider text-sm">
                      <Clock size={16} className="text-indigo-600" />
                      Currently Borrowed
                    </h4>
                    <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-full">
                      {userTransactions.filter(t => t.status === 'borrowed' || t.status === 'overdue').length} Active
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userTransactions.filter(t => t.status === 'borrowed' || t.status === 'overdue').map(t => {
                      const fine = calculateFine(t.dueDate);
                      return (
                        <div key={t.id} className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between bg-slate-50/30 group hover:border-indigo-200 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-9 bg-white rounded shadow-sm overflow-hidden flex-shrink-0 border border-slate-100">
                              <img src={t.bookCover} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 line-clamp-1">{t.bookTitle}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Due: {new Date(t.dueDate).toLocaleDateString()}</p>
                              {fine > 0 && <p className="text-[10px] text-rose-600 font-black uppercase mt-0.5 animate-pulse">Fine: ₹{fine}</p>}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleAdminReturn(t)}
                            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                            title="Force Return"
                          >
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      );
                    })}
                    {userTransactions.filter(t => t.status === 'borrowed' || t.status === 'overdue').length === 0 && (
                      <div className="col-span-full py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                        <p className="text-slate-400 text-sm italic font-medium">No active loans for this user.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Borrowing History Section */}
                <section>
                  <h4 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider text-sm mb-4">
                    <History size={16} className="text-slate-400" />
                    Borrowing History
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-6 py-4">Title</th>
                          <th className="px-6 py-4">Dates</th>
                          <th className="px-6 py-4">Fines</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {userTransactions.filter(t => t.status === 'returned').slice(0, 5).map(t => (
                          <tr key={t.id} className="text-sm group hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800">{t.bookTitle}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Issued {new Date(t.issueDate).toLocaleDateString()}</span>
                                <span className="text-[10px] text-emerald-600 font-bold uppercase">Back {new Date(t.returnDate).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {t.fineAmount > 0 ? (
                                <span className="text-rose-600 font-bold">₹{t.fineAmount}</span>
                              ) : (
                                <span className="text-emerald-500 font-bold">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {t.fineAmount > 0 && (
                                <button 
                                  onClick={() => handleWaiverFine(t.id)}
                                  className="text-[10px] font-black uppercase text-indigo-600 hover:underline"
                                >
                                  Waiver Fine
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

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Membership Status</span>
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                       <Shield size={14} className="text-indigo-600" />
                       {selectedUser.membershipStatus || 'active'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 mr-2 italic">Admin Panel Access level: 2</span>
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:shadow-xl transition-all"
                  >
                    Done
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
