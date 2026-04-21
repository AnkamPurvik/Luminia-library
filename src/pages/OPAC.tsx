import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, where, getDocs, getDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Book } from '../types';
import { BookCard } from '../components/books/BookCard';
import { Search, Filter, Loader2, Library, BookX, Database, LogIn, LogOut, Zap, Shield, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

const SAMPLE_BOOKS = [
  {
    isbn: '978-0141439518',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    genre: 'Classic',
    totalCopies: 5,
    availableCopies: 3,
    description: 'A classic novel of manners.',
    coverUrl: 'https://picsum.photos/seed/pride/400/600'
  },
  {
    isbn: '978-0743273565',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    genre: 'Fiction',
    totalCopies: 3,
    availableCopies: 0,
    description: 'A story of wealth and love in the 1920s.',
    coverUrl: 'https://picsum.photos/seed/gatsby/400/600'
  },
  {
    isbn: '978-0451524935',
    title: '1984',
    author: 'George Orwell',
    genre: 'Dystopian',
    totalCopies: 10,
    availableCopies: 7,
    description: 'A chilling prophecy about the future.',
    coverUrl: 'https://picsum.photos/seed/1984/400/600'
  },
  {
    isbn: '978-0316769174',
    title: 'The Catcher in the Rye',
    author: 'J.D. Salinger',
    genre: 'Fiction',
    totalCopies: 4,
    availableCopies: 4,
    description: 'A story of teenage rebellion.',
    coverUrl: 'https://picsum.photos/seed/catcher/400/600'
  }
];

export default function OPAC({ searchQuery: globalSearch, onSearchChange: setGlobalSearch }: { searchQuery: string, onSearchChange: (val: string) => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    
    // Catalog is only visible to authenticated users per rules
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, 'books'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const booksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Book[];
        setBooks(booksData);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching books:', err);
        try {
          handleFirestoreError(err, OperationType.GET, 'books');
        } catch (e: any) {
          setError(e.message);
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAuthLoading]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Login failed:', err);
      const errorMessage = err?.message || JSON.stringify(err);
      setModalConfig({
        isOpen: true,
        title: 'Login Failed',
        message: (
          <div className="space-y-4">
            <p>{errorMessage}</p>
            <div className="bg-slate-50 p-4 rounded-xl text-xs font-mono border border-slate-200">
              Tip: Check if your domain is authorized in Firebase Console → Authentication → Settings.
            </div>
          </div>
        ),
        type: 'danger'
      });
    }
  };

  const handleLogout = () => auth.signOut();

  const seedData = async () => {
    if (!user) {
      toast.error('You must be logged in as an admin to seed data.');
      return;
    }
    setIsSeeding(true);
    try {
      const booksCol = collection(db, 'books');
      for (const book of SAMPLE_BOOKS) {
        await addDoc(booksCol, book);
      }
      toast.success('Sample books added to the catalog!');
    } catch (err) {
      console.error('Error seeding data:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'books');
      } catch (e: any) {
        toast.error(`Failed to seed data: ${e.message}`);
      }
    } finally {
      setIsSeeding(false);
    }
  };

  const handleBorrowOrReserve = async (bookId: string) => {
    console.log('handleBorrowOrReserve called for bookId:', bookId);
    if (!user) {
      toast.error('Please sign in to borrow or reserve books.');
      return;
    }

    // 1. Fetch User Profile and Current Loan Count
    let isPro = false;
    let loanCount = 0;
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        isPro = userSnap.data().isPro || false;
      }

      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('status', 'in', ['borrowed', 'overdue'])
      );
      const transSnap = await getDocs(q);
      loanCount = transSnap.size;
    } catch (err) {
      console.error('Initial checks failed:', err);
      toast.error('Failed to verify borrowing eligibility.');
      return;
    }

    // 2. Enforce Limit
    if (!isPro && loanCount >= 5) {
      setModalConfig({
        isOpen: true,
        title: 'Borrowing Limit Reached',
        message: (
          <div className="space-y-4">
            <p>You have reached your limit of <span className="font-bold text-slate-900">5 books</span>. Please return a book or upgrade to Lumina Pro for unlimited borrowing!</p>
            <div className="bg-indigo-600 p-4 rounded-xl text-white">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={20} className="text-amber-300" />
                <span className="font-bold">Lumina Pro Advantage</span>
              </div>
              <ul className="text-xs space-y-1 text-indigo-100">
                <li>• No borrowing limits</li>
                <li>• Extended 30-day due dates</li>
                <li>• Zero overdue fines</li>
              </ul>
            </div>
          </div>
        ),
        type: 'warning',
        confirmLabel: 'Upgrade Home',
        onConfirm: () => navigate('/pro') 
      });
      return;
    }

    const book = books.find(b => b.id === bookId);
    if (!book) {
      console.error('Book not found in state:', bookId);
      return;
    }

    try {
      if (book.availableCopies > 0) {
        console.log('Attempting to borrow book:', book.title);
        // Borrow logic
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 2 weeks

        // Fetch actual member name before creating transaction
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const realName = userSnap.exists() ? (userSnap.data().name || userSnap.data().displayName || user.displayName) : user.displayName;

        const transactionData = {
          userId: user.uid,
          userName: realName || 'Member',
          userEmail: user.email || '',
          bookId: book.id,
          bookTitle: book.title,
          bookCover: book.coverUrl || '',
          borrowed_at: new Date().toISOString(), // Precision timestamp
          expected_return: dueDate.toISOString(), // Return date
          returned_at: null, // Scanned back later
          issueDate: new Date().toISOString(), // Fallback
          dueDate: dueDate.toISOString(), // Fallback
          fineAmount: 0,
          status: 'borrowed'
        };

        await addDoc(collection(db, 'transactions'), transactionData);
        console.log('Transaction created');

        await updateDoc(doc(db, 'books', book.id), {
          availableCopies: book.availableCopies - 1
        });
        console.log('Book availability updated');
        
        toast.success(`Successfully borrowed "${book.title}"!`);
      } else {
        console.log('Attempting to reserve book:', book.title);
        // Reserve logic
        const reservationData = {
          userId: user.uid,
          bookId: book.id,
          bookTitle: book.title,
          bookCover: book.coverUrl || '',
          reservationDate: new Date().toISOString(),
          status: 'pending',
          isPro: isPro
        };

        await addDoc(collection(db, 'reservations'), reservationData);
        console.log('Reservation created');
        
        toast('Book reserved. You will be notified when it is available.', {
          icon: 'ℹ️',
          className: 'text-indigo-600',
        });
      }
    } catch (err) {
      console.error('Action failed with error:', err);
      toast.error('Failed to process request.');
    }
  };

  const filteredBooks = useMemo(() => {
    const lowerQuery = globalSearch.toLowerCase();
    return books.filter(book => 
      book.title.toLowerCase().includes(lowerQuery) ||
      book.author.toLowerCase().includes(lowerQuery) ||
      book.isbn.toLowerCase().includes(lowerQuery) ||
      book.genre.toLowerCase().includes(lowerQuery)
    );
  }, [books, globalSearch]);

  return (
    <div className="min-h-screen bg-bg-dark selection:bg-primary-accent/30">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user && !isAuthLoading ? (
          <div className="py-20 space-y-32">
            {/* Hero Section */}
            <div className="flex flex-col items-center text-center px-4 relative overflow-hidden">
              {/* Decorative blobs */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-accent/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
              <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-secondary-accent/10 rounded-full blur-[80px] -z-10"></div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/5 backdrop-blur-3xl p-5 rounded-[2rem] mb-10 border border-white/10 shadow-2xl"
              >
                <Library size={56} className="text-primary-accent" />
              </motion.div>
              
              <motion.h2 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-tight uppercase"
              >
                EXPLORE YOUR <span className="text-primary-accent">KNOWLEDGE UNIVERSE</span>
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed font-medium"
              >
                The ultimate gateway to millions of titles, academic resources, and literary treasures. 
                Experience Luminia Library — where tradition meets high-performance management.
              </motion.p>
              
              <motion.button 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(79, 70, 229, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="inline-flex items-center px-10 py-5 rounded-2xl text-base font-black uppercase tracking-[0.2em] text-white bg-primary-accent shadow-xl shadow-primary-accent/20 transition-all group"
              >
                <LogIn className="mr-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                Access the Library
              </motion.button>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
              {[
                {
                  icon: <Zap className="text-secondary-accent" />,
                  title: "Live Updates",
                  desc: "Real-time resource allocation. Reserve books and get notified the millisecond they are returned."
                },
                {
                  icon: <Shield size={24} className="text-primary-accent" />,
                  title: "Lumina Security",
                  desc: "Military-grade access controls. Your borrowing history and personal data are fully protected."
                },
                {
                  icon: <Sparkles className="text-amber-400" />,
                  title: "AI Catalog",
                  desc: "Search the catalog with lightening speed using our optimized indexing and AI-driven categories."
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-panel p-10 rounded-[2.5rem] hover:bg-white/10 transition-all cursor-default"
                >
                  <div className="bg-white/5 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border border-white/5 shadow-inner">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-black text-white mb-4 tracking-tight uppercase">{feature.title}</h3>
                  <p className="text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Stats Section */}
            <div className="bg-gradient-to-r from-primary-accent/10 via-secondary-accent/10 to-primary-accent/10 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3.5rem] p-10 sm:p-16 border border-white/5 mx-4 flex flex-col md:flex-row items-center justify-around gap-12 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-primary-accent/5 animate-pulse"></div>
              <div className="text-center relative z-10">
                <p className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter">5,000+</p>
                <p className="text-primary-accent font-black uppercase tracking-[0.3em] text-[9px] sm:text-[10px]">TOTAL BOOKS</p>
              </div>
              <div className="text-center relative z-10">
                <p className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter">1,200+</p>
                <p className="text-secondary-accent font-black uppercase tracking-[0.3em] text-[9px] sm:text-[10px]">ACTIVE MEMBERS</p>
              </div>
              <div className="text-center relative z-10">
                <p className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter">99.9%</p>
                <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-[9px] sm:text-[10px]">SYSTEM UPTIME</p>
              </div>
            </div>
          </div>
        ) : isLoading || isAuthLoading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-accent/20 blur-2xl animate-pulse rounded-full"></div>
              <Loader2 className="h-12 w-12 text-primary-accent animate-spin relative z-10" />
            </div>
            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] mt-8 animate-pulse">Loading Library Catalog...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-10 text-center backdrop-blur-xl">
            <p className="text-rose-400 font-black tracking-tight">{error}</p>
          </div>
        ) : (
          <div className="pt-8">
            <div className="mb-10 flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="text-3xl font-black text-white tracking-tight uppercase">Library Catalog</h2>
                <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mt-1">
                  Exploring <span className="text-primary-accent font-black tracking-widest">{filteredBooks.length}</span> Active Titles
                </p>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {filteredBooks.length > 0 ? (
                <motion.div 
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                  {filteredBooks.map((book) => (
                    <BookCard 
                      key={book.id} 
                      book={book} 
                      onReserve={handleBorrowOrReserve}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <BookX size={48} className="text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">No books found</h3>
                  <p className="text-slate-500 max-w-xs">
                    We couldn't find any books matching "{globalSearch}". Try adjusting your search terms.
                  </p>
                  <button 
                    onClick={() => setGlobalSearch('')}
                    className="mt-4 text-primary-accent font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors border border-primary-accent/30 px-6 py-2 rounded-full"
                  >
                    Clear search
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

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
