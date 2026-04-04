import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
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

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
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

      toast('Book reserved. You will be notified when it is available.', {
        icon: 'ℹ️',
        className: 'text-indigo-600',
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 inline-block">
          <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">{error || 'Something went wrong'}</h2>
          <button 
            onClick={() => navigate('/')}
            className="text-indigo-600 font-semibold hover:underline"
          >
            Return to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-slate-500 hover:text-slate-900 mb-8 transition-colors group"
      >
        <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Catalog
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Book Cover */}
        <div className="lg:col-span-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden sticky top-24"
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
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-slate-500 font-medium">Availability</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  book.availableCopies > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {book.availableCopies} / {book.totalCopies} Copies
                </span>
              </div>
              <button 
                onClick={handleBorrow}
                disabled={book.availableCopies === 0 || isProcessing}
                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  book.availableCopies > 0 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <ShoppingBag size={20} />}
                {book.availableCopies > 0 ? 'Borrow This Book' : 'Currently Unavailable'}
              </button>

              {book.availableCopies === 0 && (
                <button 
                  onClick={handleReserve}
                  disabled={isProcessing}
                  className="w-full mt-3 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Bookmark size={20} />}
                  Reserve This Book
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-8 space-y-8">
          <section>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight font-display mb-2">{book.title}</h1>
            <div className="flex items-center text-xl text-slate-600 font-medium mb-6">
              <User size={20} className="mr-2" />
              {book.author}
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
              <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold">
                <Tag size={14} className="mr-1.5" />
                {book.genre}
              </span>
              <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold">
                <Hash size={14} className="mr-1.5" />
                ISBN: {book.isbn}
              </span>
            </div>

            <div className="prose prose-slate max-w-none">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Info size={18} className="text-indigo-600" />
                Synopsis
              </h3>
              <p className="text-slate-600 leading-relaxed text-lg">
                {book.description || 'No description available for this title.'}
              </p>
            </div>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
              <History size={18} className="text-indigo-600" />
              Recent Activity
            </h3>
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Borrowed by Member</p>
                        <p className="text-xs text-slate-500">
                          {new Date(t.issueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                      t.status === 'returned' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic text-sm">No recent borrowing history found.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
