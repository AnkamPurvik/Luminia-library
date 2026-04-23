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

import { User as FirebaseUser } from 'firebase/auth';

export default function AdminBookDetail({ user, profile }: { user: FirebaseUser | null, profile: any }) {
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

    // Real-time Activity Updates
    const q = query(
      collection(db, 'transactions'),
      where('bookId', '==', id)
    );
    
    // User cache to avoid N+1 queries
    const userCache: Record<string, string> = {};

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const transData = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let name = data.userName;
        
        // If name is missing or generic, try to fetch from user profile
        if (!name || name === 'Member' || name === 'Anonymous Member' || name === 'member') {
          if (userCache[data.userId]) {
            name = userCache[data.userId];
          } else {
            try {
              const userSnap = await getDoc(doc(db, 'users', data.userId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                name = userData.name || userData.displayName || userData.username || userData.email || 'Member';
                userCache[data.userId] = name; // Cache it
              }
            } catch (e) {
              console.error("Error fetching user name:", e);
            }
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
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="absolute inset-0 bg-primary-accent/20 blur-xl animate-pulse rounded-full"></div>
          <Loader2 className="h-10 w-10 text-primary-accent animate-spin relative z-10" />
        </div>
        <p className="mt-8 text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Loading Activity Logs...</p>
      </div>
    );
  }

  if (!book) return null;

  const filteredTransactions = transactions.filter(t => 
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.userName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumbs & Navigation */}
      <div className="flex items-center justify-between mb-12">
        <button 
          onClick={() => navigate('/admin')}
          className="flex items-center text-slate-500 hover:text-primary-accent font-black uppercase tracking-widest text-[10px] transition-all gap-4 group"
        >
          <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-primary-accent/10 border border-white/5 transition-all">
            <ArrowLeft size={16} />
          </div>
          Back to Dashboard
        </button>
        
        <div className="flex gap-3">
           <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-accent transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/30 outline-none w-72 transition-all shadow-inner placeholder-slate-600 text-white"
            />
          </div>
        </div>
      </div>

      {/* Book Overview Card */}
      <div className="glass-panel rounded-[2.5rem] p-10 border-white/5 shadow-2xl mb-16 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-accent/5 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-primary-accent/10" />
        
        <div className="flex flex-col md:flex-row gap-12 items-center md:items-start relative z-10">
          <div className="w-48 flex-shrink-0">
            <div className="aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border border-white/10 group-hover:scale-[1.02] transition-transform">
              <img 
                src={book.coverUrl || 'https://via.placeholder.com/400x600'} 
                alt={book.title} 
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
          
          <div className="flex-grow text-center md:text-left">
            <div className="flex flex-wrap items-center gap-4 mb-4 justify-center md:justify-start">
              <span className="px-4 py-1.5 bg-white/5 text-primary-accent rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5">
                {book.genre}
              </span>
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">ISBN: {book.isbn}</span>
            </div>
            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase leading-tight">{book.title}</h1>
            <p className="text-xl text-slate-400 font-bold uppercase tracking-tight mb-10 flex items-center justify-center md:justify-start gap-3">
              <User size={24} className="text-primary-accent" />
              {book.author}
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: 'Activity Logs', value: transactions.length, icon: History, color: 'text-indigo-400' },
                { label: 'Current Loans', value: transactions.filter(t => t.status === 'borrowed').length, icon: Clock, color: 'text-amber-400' },
                { label: 'Avg Loan Period', value: '12 Days', icon: Calendar, color: 'text-emerald-400' },
                { label: 'Total Fines', value: `₹${transactions.reduce((acc, t) => acc + calculateLateFee(t.expected_return, t.returned_at), 0)}`, icon: IndianRupee, color: 'text-rose-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 p-5 rounded-3xl border border-white/5 shadow-inner">
                  <div className={`${stat.color} mb-2`}><stat.icon size={18} /></div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                  <p className="text-xl font-black text-white uppercase tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

        {/* Time-Action Audit Log */}
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-4 uppercase">
            <History className="text-primary-accent" size={28} />
            Borrowing History & Activity
          </h2>
          <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-5 py-2.5 rounded-xl border border-white/5 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-primary-accent shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
            Live History
          </div>
        </div>

          {filteredTransactions.length > 0 ? (
          <div className="space-y-0 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-[2px] before:bg-white/5 before:shadow-inner">
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
                  className="relative pl-24 pb-12 group"
                >
                  {/* Timeline Node */}
                  <div className={`absolute left-6 top-0 w-4 h-4 rounded-full border-4 border-bg-dark shadow-2xl z-10 transition-transform group-hover:scale-125 ${
                    isReturned ? (delta <= 0 ? 'bg-emerald-500' : 'bg-rose-500') : 
                    isOverdue ? 'bg-rose-500 animate-pulse' : 'bg-primary-accent shadow-[0_0_12px_rgba(79,70,229,0.4)]'
                  }`} />
                  
                  <div className={`glass-panel rounded-[2rem] border p-8 transition-all group-hover:bg-white/[0.07] group-hover:border-white/10 ${
                    (isOverdue || (isReturned && delta > 0)) ? 'border-rose-500/20 bg-rose-500/[0.03]' : 'border-white/5'
                  }`}>
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* User Profile Hook */}
                      <div className="lg:w-56 flex-shrink-0">
                        <Link 
                          to={`/admin?user=${t.userId}`} 
                          className="flex items-center gap-4 group/user bg-white/5 hover:bg-primary-accent/10 p-3 rounded-2xl transition-all border border-white/5 hover:border-primary-accent/20"
                        >
                          <div className="w-12 h-12 rounded-xl bg-primary-accent/10 border border-primary-accent/20 flex items-center justify-center text-primary-accent font-black text-sm shadow-inner group-hover/user:scale-110 transition-transform">
                            {t.userName?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                             <div className="flex items-center gap-1.5">
                              <p className="text-sm font-black text-white group-hover/user:text-primary-accent transition-colors truncate uppercase tracking-tight">{t.userName}</p>
                            </div>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5 truncate">{t.status} Member</p>
                          </div>
                        </Link>
                      </div>

                      {/* Audit Details */}
                      <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                        <div>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Borrowed On</p>
                          <div className="flex items-center gap-3 text-white font-black text-sm tracking-tight">
                            <TrendingDown size={14} className="text-primary-accent" />
                            {new Date(t.borrowed_at).toLocaleDateString('en-GB')}
                            <span className="text-[10px] text-slate-500">
                              {new Date(t.borrowed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Due Date</p>
                          <div className="flex items-center gap-3 text-white font-black text-sm tracking-tight">
                            <Calendar size={14} className="text-secondary-accent" />
                            {new Date(t.expected_return).toLocaleDateString('en-GB')}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Returned On</p>
                          <div className="flex items-center gap-3 text-white font-black text-sm tracking-tight">
                            <TrendingUp size={14} className={isReturned ? 'text-emerald-400' : 'text-slate-700'} />
                            {isReturned ? (
                              <>
                                {new Date(t.returned_at!).toLocaleDateString('en-GB')}
                                <span className="text-[10px] text-slate-500">
                                  {new Date(t.returned_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-700 font-black uppercase tracking-widest text-[10px]">Active Loan</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status & Delta & Fees */}
                      <div className="lg:w-64 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-white/5 pt-6 lg:pt-0 lg:pl-8 gap-4">
                        {isReturned ? (
                          delta <= 0 ? (
                            <div className="flex items-center gap-3 bg-emerald-500/10 text-emerald-400 px-5 py-2.5 rounded-xl border border-emerald-400/20 shadow-inner">
                              <CheckCircle2 size={16} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Returned on Time</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 bg-rose-500/10 text-rose-400 px-5 py-2.5 rounded-xl border border-rose-400/20 shadow-inner">
                              <AlertCircle size={16} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Overdue return</span>
                            </div>
                          )
                        ) : isOverdue ? (
                          <div className="flex items-center gap-3 bg-rose-500 text-white px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                            <AlertCircle size={16} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Delayed {Math.abs(delta)} Days</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-primary-accent/10 text-primary-accent px-5 py-2.5 rounded-xl border border-primary-accent/20 shadow-inner">
                            <Clock size={16} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Currently Borrowed</span>
                          </div>
                        )}

                        {(lateFee > 0 || isOverdue) && (
                          <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                            isReturned ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-inner'
                          }`}>
                            <span className="text-[8px] font-black uppercase tracking-[0.2em]">Fine Amount</span>
                            <span className="text-sm font-black flex items-center">
                              <IndianRupee size={12} className="mr-0.5" />
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
            <div className="glass-panel rounded-[2.5rem] p-24 text-center border-dashed border-white/5 opacity-50">
               <div className="bg-white/5 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/5">
                 <History size={40} className="text-slate-600" />
               </div>
               <h3 className="text-xl font-black text-white uppercase tracking-tighter">No borrowing history</h3>
               <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2">This book has not been borrowed by any members yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }
