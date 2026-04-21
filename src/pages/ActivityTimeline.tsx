import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Filter, Library, LayoutDashboard, Shield, 
  History, Settings, LogOut, CheckCircle2, AlertTriangle, 
  Info, XCircle, User, BookOpen, UserPlus, Database,
  ArrowRight, Loader2
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ActivityLog } from '../types';
import toast from 'react-hot-toast';

export default function ActivityTimeline() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setLogs(logsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      toast.error("Failed to load activity logs.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
      toast.success('Signed out successfully');
    } catch (err) {
      toast.error('Failed to sign out');
    }
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusStyles = (status: ActivityLog['status']) => {
    switch (status) {
      case 'SUCCESS': return 'bg-emerald-500 text-white';
      case 'WARNING': return 'bg-amber-400 text-white';
      case 'INFO': return 'bg-blue-500 text-white';
      case 'ERROR': return 'bg-rose-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getIcon = (log: ActivityLog) => {
    if (log.status === 'SUCCESS') return <CheckCircle2 size={16} className="text-white" />;
    if (log.status === 'WARNING') return <AlertTriangle size={16} className="text-white" />;
    if (log.status === 'ERROR') return <XCircle size={16} className="text-white" />;
    if (log.status === 'INFO') return <Info size={16} className="text-white" />;
    return <Info size={16} className="text-white" />;
  };

  const getIconBg = (status: ActivityLog['status']) => {
    switch (status) {
      case 'SUCCESS': return 'bg-emerald-500';
      case 'WARNING': return 'bg-amber-400';
      case 'INFO': return 'bg-blue-500';
      case 'ERROR': return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="p-10 max-w-6xl w-full mx-auto pb-32">
      <header className="mb-12 relative z-10">
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Activity Timeline</h1>
        <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mb-8">Monitoring real-time library operations.</p>
        
        <div className="flex gap-4">
          <div className="relative flex-1 group invisible pointer-events-none">
            {/* Search is now in global Header, hidden here but keeping layout space if needed */}
          </div>
          <button className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95">
            <Filter size={18} />
            Filter
          </button>
        </div>
      </header>

      <div className="relative z-10">
        <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-white/5 -translate-x-1/2" />

        <div className="space-y-12">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 size={40} className="animate-spin mb-4 text-primary-accent" />
              <p className="font-black uppercase tracking-[0.2em] text-[10px]">Loading activity...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <History size={40} className="mb-4 opacity-20" />
              <p className="font-black uppercase tracking-[0.2em] text-[10px]">No activity logs found</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative flex gap-8 group"
            >
              {/* Timeline Dot/Icon */}
              <div className={`relative z-10 w-12 h-12 rounded-2xl border-2 border-bg-dark shadow-xl flex items-center justify-center shrink-0 ${getIconBg(log.status)}`}>
                {getIcon(log)}
              </div>

              <div className="flex-1 flex justify-between items-start glass-panel rounded-[2rem] p-6 border-white/5 group-hover:border-primary-accent/20 transition-all shadow-2xl">
                <div className="flex gap-4">
                  {/* Avatar for user logs */}
                  {log.type !== 'system' && (
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-inner">
                      {log.user?.photoURL ? (
                        <img src={log.user.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-primary-accent font-black uppercase text-xs">
                          {log.type === 'member' ? <UserPlus size={20} className="text-primary-accent" /> : log.user?.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                  )}
                  {log.type === 'system' && (
                    <div className="w-12 h-12 rounded-xl bg-rose-50 border-2 border-rose-100 flex items-center justify-center shrink-0">
                      <Database size={20} className="text-rose-600" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="font-black text-white text-lg tracking-tight flex items-center gap-2 uppercase">
                      {log.type === 'member' && <span className="text-emerald-400">New Member</span>}
                      {log.type === 'user' && <span className="text-slate-400">User: <span className="text-white">{log.user?.name}</span></span>}
                      {log.type === 'admin' && <span className="text-slate-400">Admin: <span className="text-white">{log.user?.name}</span></span>}
                      {log.type === 'system' && <span className="text-rose-400">{log.action}</span>}
                    </h3>
                    {log.type !== 'system' && <p className="text-slate-200 text-sm font-bold uppercase tracking-tight">{log.action}</p>}
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{log.details}</p>
                    {log.metadata && (
                      <p className="text-primary-accent font-black text-[8px] uppercase tracking-[0.3em] mt-1">{log.metadata}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-4">
                     {log.status === 'WARNING' && (
                      <span className="text-[8px] font-black bg-amber-400/10 text-amber-500 px-2 py-0.5 rounded-md uppercase tracking-[0.2em] border border-amber-400/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]">
                        WARNING
                      </span>
                    )}
                    <span className="text-[10px] font-black text-slate-500 tracking-widest">{log.timestamp}</span>
                    {log.status !== 'WARNING' && (
                      <span className={`text-[8px] font-black px-2.5 py-1 rounded-md uppercase tracking-[0.2em] border shadow-lg ${getStatusStyles(log.status)}`}>
                        {log.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )))}
        </div>
      </div>
    </div>
  );
}
