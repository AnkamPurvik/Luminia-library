import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Book } from '../types';
import { motion } from 'motion/react';
import { 
  ArrowLeft, BookOpen, Clock, AlertCircle, 
  CheckCircle2, User, ExternalLink, Calendar,
  TrendingDown, TrendingUp, IndianRupee,
  History, Search, Filter, Loader2
} from 'lucide-react';

interface TransactionLog {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  borrowed_at: string;
  returned_at?: string;
  expected_return: string;
  status: 'borrowed' | 'returned' | 'overdue';
}

export default function AdminBookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!id) return;

    // Fetch Book Details
    const fetchBook = async () => {
      const snap = await getDoc(doc(db, 'books', id));
      if (snap.exists()) {
        setBook({ id: snap.id, ...snap.data() } as Book);
      }
    };
    fetchBook();

    // Real-time Transactions Sync
    const q = query(
      collection(db, 'transactions'),
      where('bookId', '==', id)
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const transData = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let name = data.userName;
        
        // If name is missing or generic, try to fetch from user profile
        if (!name || name === 'Member' || name === 'Anonymous Member' || name === 'member') {
          try {
            const userSnap = await getDoc(doc(db, 'users', data.userId));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              name = userData.name || userData.displayName || userData.username || userData.email || 'Member';
            }
          } catch (e) {
            console.error("Error fetching user name:", e);
          }
        }

        return {
          id: docSnap.id,
          userId: data.userId,
          borrowed_at: data.borrowed_at || data.issueDate,
          returned_at: data.returned_at || data.returnDate,
          expected_return: data.expected_return || data.dueDate,
          status: data.status,
          userName: name || 'Anonymous Member',
          userEmail: data.userEmail || '',
        } as TransactionLog;
      }));
      
      setTransactions(transData.sort((a, b) => new Date(b.borrowed_at).getTime() - new Date(a.borrowed_at).getTime()));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const calculateLateFee = (expected: string, actual?: string) => {
    const due = new Date(expected);
    const end = actual ? new Date(actual) : new Date();
    
    if (end > due) {
      const diffTime = Math.abs(end.getTime() - due.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays * 10; // ₹10 per day
    }
    return 0;
  };

  const getDurationDelta = (expected: string, actual?: string) => {
    const due = new Date(expected);
    const end = actual ? new Date(actual) : new Date();
    const diffTime = end.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!book) return null;

  const filteredTransactions = transactions.filter(t => 
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.userName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumbs & Navigation */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center text-slate-500 hover:text-indigo-600 font-bold transition-colors gap-2 group"
          >
            <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-indigo-50 border border-slate-100 transition-all">
              <ArrowLeft size={20} />
            </div>
            Back to Dashboard
          </button>
          
          <div className="flex gap-3">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Search history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Book Overview Card */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm mb-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 opacity-50" />
          
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
            <div className="w-40 flex-shrink-0">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                <img 
                  src={book.coverUrl || 'https://via.placeholder.com/400x600'} 
                  alt={book.title} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="flex-grow text-center md:text-left">
              <div className="flex flex-wrap items-center gap-3 mb-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                  {book.genre}
                </span>
                <span className="text-slate-400 text-xs font-medium">ISBN: {book.isbn}</span>
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 mb-2 leading-tight">{book.title}</h1>
              <p className="text-lg text-slate-500 font-medium mb-6 flex items-center justify-center md:justify-start gap-2">
                <User size={20} className="text-indigo-600" />
                {book.author}
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Borrows', value: transactions.length, icon: History, color: 'text-blue-500' },
                  { label: 'Active Loans', value: transactions.filter(t => t.status === 'borrowed').length, icon: Clock, color: 'text-amber-500' },
                  { label: 'Avg. Duration', value: '12 Days', icon: Calendar, color: 'text-emerald-500' },
                  { label: 'Total Revenue', value: `₹${transactions.reduce((acc, t) => acc + calculateLateFee(t.expected_return, t.returned_at), 0)}`, icon: IndianRupee, color: 'text-rose-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <div className={`${stat.color} mb-1`}><stat.icon size={18} /></div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                    <p className="text-lg font-black text-slate-800">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Time-Action Audit Log */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <History className="text-indigo-600" />
              History Timeline & Movement
            </h2>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              Sorted by Recency
            </div>
          </div>

          {filteredTransactions.length > 0 ? (
            <div className="space-y-0 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
              {filteredTransactions.map((t, index) => {
                const lateFee = calculateLateFee(t.expected_return, t.returned_at);
                const delta = getDurationDelta(t.expected_return, t.returned_at);
                const isReturned = !!t.returned_at;
                const isOverdue = !isReturned && new Date() > new Date(t.expected_return);

                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={t.id} 
                    className="relative pl-20 pb-10 group"
                  >
                    {/* Timeline Node */}
                    <div className={`absolute left-6 top-0 w-5 h-5 rounded-full border-4 border-[#F8FAFC] shadow-sm z-10 transition-transform group-hover:scale-125 ${
                      isReturned ? (delta <= 0 ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200') : 
                      isOverdue ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'
                    }`} />
                    
                    <div className={`bg-white rounded-3xl border p-6 transition-all hover:shadow-xl hover:shadow-indigo-50/50 ${
                      (isOverdue || (isReturned && delta > 0)) ? 'border-rose-100' : 'border-slate-100'
                    }`}>
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* User Profile Hook */}
                        <div className="lg:w-48 flex-shrink-0">
                          <Link 
                            to={`/admin?user=${t.userId}`} 
                            className="flex items-center gap-3 group/user hover:bg-slate-50 p-2 rounded-2xl transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs">
                              {t.userName?.charAt(0) || 'U'}
                            </div>
                            <div>
                               <div className="flex items-center gap-1">
                                <p className="text-sm font-black text-slate-800 group-hover/user:text-indigo-600">{t.userName}</p>
                                <ExternalLink size={12} className="text-slate-300 group-hover/user:text-indigo-400" />
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[100px]">{t.status}</p>
                            </div>
                          </Link>
                        </div>

                        {/* Audit Details */}
                        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Borrowed At</p>
                            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                              <TrendingDown size={14} className="text-indigo-500" />
                              {new Date(t.borrowed_at).toLocaleDateString('en-GB')}
                              <span className="text-[10px] font-medium text-slate-400">
                                {new Date(t.borrowed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Expected Return</p>
                            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                              <Calendar size={14} className="text-indigo-400" />
                              {new Date(t.expected_return).toLocaleDateString('en-GB')}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Returned At</p>
                            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                              <TrendingUp size={14} className={isReturned ? 'text-emerald-500' : 'text-slate-300'} />
                              {isReturned ? (
                                <>
                                  {new Date(t.returned_at!).toLocaleDateString('en-GB')}
                                  <span className="text-[10px] font-medium text-slate-400">
                                    {new Date(t.returned_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-400 font-medium italic">Not returned yet</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status & Delta & Fees */}
                        <div className="lg:w-64 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-6 gap-3">
                          {isReturned ? (
                            delta <= 0 ? (
                              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100">
                                <CheckCircle2 size={16} />
                                <span className="text-xs font-black uppercase tracking-tight">Returned on time (In {14 + delta} days)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-2 rounded-xl border border-rose-100">
                                <AlertCircle size={16} />
                                <span className="text-xs font-black uppercase tracking-tight">Overdue (Returned {delta} days late)</span>
                              </div>
                            )
                          ) : isOverdue ? (
                            <div className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-rose-100">
                              <AlertCircle size={16} className="animate-bounce" />
                              <span className="text-xs font-black uppercase tracking-tight">System Flagged: {Math.abs(delta)} Days Late</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl border border-indigo-100">
                              <Clock size={16} />
                              <span className="text-xs font-black uppercase tracking-tight">Active Loan ({14 + delta} days left)</span>
                            </div>
                          )}

                          {(lateFee > 0 || isOverdue) && (
                            <div className={`flex items-center justify-between p-3 rounded-2xl border ${
                              isReturned ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                              <span className="text-[10px] font-black uppercase">Calculated Late Fee</span>
                              <span className="text-sm font-black flex items-center">
                                <IndianRupee size={14} />
                                {lateFee}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] p-20 text-center border border-slate-100">
               <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                 <History size={32} className="text-slate-300" />
               </div>
               <h3 className="text-lg font-bold text-slate-900">No Movement Detected</h3>
               <p className="text-slate-500 max-w-xs mx-auto mt-2">This book has not been borrowed yet. Once a member borrows it, the movement logs will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
