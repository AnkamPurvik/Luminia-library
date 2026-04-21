import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth, logActivity } from '../lib/firebase';
import { Book, Transaction } from '../types';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, BookOpen, User, Hash, Tag, 
  Calendar, Info, History, Loader2, AlertCircle, ShoppingBag, Bookmark
} from 'lucide-react';

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchBookData = async () => {
      if (!id) return;
      try {
        const bookDoc = await getDoc(doc(db, 'books', id));
        if (bookDoc.exists()) {
          setBook({ id: bookDoc.id, ...bookDoc.data() } as Book);
          
          // Fetch recent borrowing history for this book
          const historyQuery = query(
            collection(db, 'transactions'),
            where('bookId', '==', id),
            limit(20)
          );
          const historySnap = await getDocs(historyQuery);
          const historyData = historySnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Transaction))
            .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
            .slice(0, 5);
          setHistory(historyData);
        } else {
          setError('Book not found');
        }
      } catch (err) {
        console.error('Error fetching book details:', err);
        setError('Failed to load book details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookData();
  }, [id]);

  const handleBorrow = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('Please sign in to borrow books.');
      return;
    }
    if (!book) return;

    setIsProcessing(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const realName = userSnap.exists() ? (userSnap.data().name || userSnap.data().displayName || user.displayName) : user.displayName;

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: realName || 'Member',
        userEmail: user.email || '',
        bookId: book.id,
        bookTitle: book.title,
        bookCover: book.coverUrl,
        borrowed_at: new Date().toISOString(),
        expected_return: dueDate.toISOString(),
        returned_at: null,
        issueDate: new Date().toISOString(),
        dueDate: dueDate.toISOString(),
        status: 'borrowed',
        fineAmount: 0
      });

      await updateDoc(doc(db, 'books', book.id), {
        availableCopies: book.availableCopies - 1
      });

      // Refresh local state
      setBook(prev => prev ? { ...prev, availableCopies: prev.availableCopies - 1 } : null);
      await logActivity({
        type: 'user',
        user: { name: realName || 'Member' },
        action: `Borrowed book: ${book.title}`,
        details: `Due on: ${dueDate.toLocaleDateString()}`,
        status: 'SUCCESS'
      });
      toast.success('Book successfully borrowed!');
    } catch (err) {
      console.error('Borrow error:', err);
      toast.error('Failed to borrow book.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReserve = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('Please sign in to reserve books.');
      return;
    }
    if (!book) return;

    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'reservations'), {
        userId: user.uid,
        bookId: book.id,
        bookTitle: book.title,
        bookCover: book.coverUrl,
        reservationDate: new Date().toISOString(),
        status: 'pending'
      });

      await logActivity({
        type: 'user',
        user: { name: auth.currentUser?.displayName || 'Member' },
        action: `Reserved book: ${book.title}`,
        details: `Reservation ID: ${id}`,
        status: 'INFO'
      });

      toast('Book reserved. You will be notified when it is available.', {
        icon: 'ℹ️',
        className: 'text-primary-accent',
      });
    } catch (err) {
      console.error('Reserve error:', err);
      toast.error('Failed to reserve book.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="absolute inset-0 bg-primary-accent/20 blur-xl animate-pulse rounded-full"></div>
          <Loader2 className="h-10 w-10 text-primary-accent animate-spin relative z-10" />
        </div>
        <p className="mt-8 text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Loading Book Details...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <div className="glass-panel border-rose-500/20 rounded-3xl p-12 inline-block">
          <AlertCircle size={48} className="text-rose-500 mx-auto mb-6" />
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">{error || 'Something went wrong'}</h2>
          <button 
            onClick={() => navigate('/')}
            className="text-primary-accent font-black uppercase tracking-widest text-xs hover:text-white transition-colors"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-slate-500 hover:text-primary-accent mb-12 transition-all group font-black uppercase tracking-widest text-[10px]"
      >
        <ArrowLeft size={16} className="mr-3 group-hover:-translate-x-1 transition-transform" />
        Back to Catalog
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Left: Book Cover */}
        <div className="lg:col-span-4">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-[2.5rem] shadow-2xl border-white/5 overflow-hidden sticky top-24"
          >
            {book.coverUrl ? (
              <img 
                src={book.coverUrl} 
                alt={book.title} 
                className="w-full aspect-[3/4] object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full aspect-[3/4] bg-slate-100 flex items-center justify-center text-slate-300">
                <BookOpen size={80} />
              </div>
            )}
            <div className="p-8">
              <div className="flex justify-between items-center mb-8 bg-white/5 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Inventory Status</span>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-lg ${
                  book.availableCopies > 0 ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'
                }`}>
                  {book.availableCopies} / {book.totalCopies} Available
                </span>
              </div>
              <button 
                onClick={handleBorrow}
                disabled={book.availableCopies === 0 || isProcessing}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 shadow-2xl ${
                  book.availableCopies > 0 
                    ? 'bg-primary-accent text-white hover:bg-primary-accent/90 shadow-primary-accent/20 active:scale-95'
                    : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                }`}
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                {book.availableCopies > 0 ? 'Borrow Book' : 'Currently Out of Stock'}
              </button>

              {book.availableCopies === 0 && (
                <button 
                  onClick={handleReserve}
                  disabled={isProcessing}
                  className="w-full mt-4 py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Bookmark size={18} />}
                  Reserve Book
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-8 space-y-12">
          <section>
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase mb-4">{book.title}</h1>
            <div className="flex items-center text-xl text-slate-500 font-bold uppercase tracking-tight mb-8">
              <User size={24} className="mr-3 text-primary-accent" />
              {book.author}
            </div>
 
            <div className="flex flex-wrap gap-4 mb-10">
              <span className="inline-flex items-center px-5 py-2 glass-panel text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 shadow-xl">
                <Tag size={14} className="mr-2 text-primary-accent" />
                {book.genre}
              </span>
              <span className="inline-flex items-center px-5 py-2 glass-panel text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 shadow-xl">
                <Hash size={14} className="mr-2 text-secondary-accent" />
                ISBN: {book.isbn}
              </span>
            </div>
 
            <div className="space-y-6">
              <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <Info size={20} className="text-primary-accent" />
                Description
              </h3>
              <p className="text-slate-500 leading-relaxed text-lg font-bold uppercase tracking-tight">
                {book.description || 'No description available for this title.'}
              </p>
            </div>
          </section>
 
          <hr className="border-white/5" />
 
          <section>
            <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter mb-8">
              <History size={20} className="text-secondary-accent" />
              Recent Activity
            </h3>
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-6 glass-panel border-white/5 rounded-3xl group hover:border-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 border border-white/10 group-hover:text-primary-accent transition-colors">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">Member Account</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
                          BORROWED: {new Date(t.issueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border shadow-lg ${
                      t.status === 'returned' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20' : 'bg-primary-accent/10 text-primary-accent border-primary-accent/20'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 glass-panel border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-center opacity-40">
                <History size={40} className="text-slate-500 mb-4" />
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">No recent borrowing history found.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
