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
          expected_return: dueDate.toISOString(), // System deadline
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
    <div className="min-h-screen bg-slate-50">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user && !isAuthLoading ? (
          <div className="py-12 space-y-24">
            {/* Hero Section */}
            <div className="flex flex-col items-center text-center px-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-50 p-4 rounded-2xl mb-8"
              >
                <Library size={48} className="text-indigo-600" />
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight"
              >
                The Future of <span className="text-indigo-600">Knowledge Management</span>
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed"
              >
                Experience the next generation of library systems. Browse thousands of titles, 
                manage your loans effortlessly, and get notified instantly when your 
                reserved books become available.
              </motion.p>
              <motion.button 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => navigate('/login')}
                className="inline-flex items-center px-8 py-4 border border-transparent rounded-2xl text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 group"
              >
                <LogIn className="mr-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                Get Started
              </motion.button>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
              {[
                {
                  icon: <Zap className="text-amber-500" />,
                  title: "Instant Reservations",
                  desc: "Ran out of copies? Hit reserve and we'll hold the next available copy just for you."
                },
                {
                  icon: <Shield className="text-emerald-500" />,
                  title: "Smart Tracking",
                  desc: "Keep track of due dates and avoid fines with our automated notification system."
                },
                {
                  icon: <Sparkles className="text-purple-500" />,
                  title: "AI Cataloging",
                  desc: "Searching made simple with our intelligent genre and category matching system."
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (i * 0.1) }}
                  className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="bg-slate-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Stats Section */}
            <div className="bg-indigo-600 rounded-[3rem] p-12 text-white mx-4 flex flex-col md:flex-row items-center justify-around gap-12 shadow-2xl shadow-indigo-200">
              <div className="text-center">
                <p className="text-4xl font-black mb-2">5,000+</p>
                <p className="text-indigo-100 font-medium uppercase tracking-widest text-xs">Curated Books</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-black mb-2">1,200+</p>
                <p className="text-indigo-100 font-medium uppercase tracking-widest text-xs">Active Readers</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-black mb-2">99.9%</p>
                <p className="text-indigo-100 font-medium uppercase tracking-widest text-xs">Uptime Service</p>
              </div>
            </div>
          </div>
        ) : isLoading || isAuthLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Loading catalog...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
            <p className="text-rose-700 font-medium">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-900">{filteredBooks.length}</span> books
              </p>
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
                    className="mt-4 text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    Clear search
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
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
