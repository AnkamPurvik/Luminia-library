import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Search, Filter, Library, LayoutDashboard, Shield, 
  History, Settings, LogOut, CheckCircle2, AlertTriangle, 
  Info, XCircle, User, BookOpen, UserPlus, Database,
  ArrowRight
} from 'lucide-react';
import { ActivityLog } from '../types';

export default function ActivityTimeline() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const logs: ActivityLog[] = [
    {
      id: '#982371',
      type: 'user',
      user: {
        name: 'Sarah Jenkins',
        photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150'
      },
      action: 'Borrowed \uD83D\uDCD6 The Great Gatsby',
      details: 'Transaction ID: #982371',
      timestamp: '10:45 AM',
      status: 'SUCCESS'
    },
    {
      id: '#982372',
      type: 'user',
      user: {
        name: 'Mark Davis',
        photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150'
      },
      action: 'Processed a late return for \uD83D\uDCD6 1984',
      details: 'Fine accrued: $1.50',
      timestamp: '10:30 AM',
      status: 'WARNING'
    },
    {
      id: '#M-4521',
      type: 'member',
      user: {
        name: 'Jessica Lee',
      },
      action: 'New Member Joined',
      details: 'Role: Member',
      metadata: 'Membership ID: #M-4521',
      timestamp: '10:15 AM',
      status: 'SUCCESS'
    },
    {
      id: '#A-101',
      type: 'admin',
      user: {
        name: 'Purvik Ankam',
        photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150'
      },
      action: 'Updated catalog item \uD83D\uDCD6 It Ends With Us',
      details: 'Stock count increased to 5',
      timestamp: '10:00 AM',
      status: 'INFO'
    },
    {
      id: '#DB-01',
      type: 'system',
      action: 'System Alert',
      details: 'Database backup failed. Retrying...',
      metadata: 'Server: DB-01',
      timestamp: '9:45 AM',
      status: 'ERROR'
    },
    {
      id: '#R-1198',
      type: 'user',
      user: {
        name: 'Alex Chen',
        photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
      },
      action: 'Reserved \uD83D\uDCD6 Dune',
      details: 'Reservation ID: #R-1198',
      timestamp: '9:30 AM',
      status: 'SUCCESS'
    }
  ];

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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 blur-3xl rounded-full -ml-32 -mb-32" />

        {/* Logo */}
        <div className="flex items-center gap-3 z-10">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 shadow-lg">
            <Library className="text-white" size={24} />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">Lumina Library</span>
        </div>

        {/* Admin Profile Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between z-10 group hover:bg-white/15 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-indigo-400/30">
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150" 
                alt="Admin" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Admin:</p>
              <p className="text-sm font-black text-white">Purvik Ankam</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 text-white/60 hover:text-white transition-colors">
              <Settings size={18} />
            </button>
            <button className="p-1.5 text-white/60 hover:text-white transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 z-10">
          {[
            { label: 'Catalog', icon: Search, path: '/' },
            { label: 'My Dashboard', icon: LayoutDashboard, path: '/dashboard' },
            { label: 'Admin Console', icon: Shield, path: '/admin' },
            { label: 'Activity Timeline', icon: History, path: '/admin/timeline', active: true },
            { label: 'Settings', icon: Settings, path: '/settings' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-bold text-sm ${
                item.active 
                  ? 'bg-indigo-600/40 text-white border border-indigo-400/30 shadow-lg shadow-black/20' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white shadow-[-20px_0_40px_rgba(0,0,0,0.02)] z-0">
        <div className="p-10 max-w-5xl w-full mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight font-display mb-8">Admin Activity Timeline</h1>
            
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search activity logs..."
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="flex items-center gap-2 px-6 py-3.5 border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95">
                <Filter size={20} />
                Filter
              </button>
            </div>
          </header>

          {/* Timeline List */}
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-1 bg-slate-100 -translate-x-1/2" />

            <div className="space-y-12">
              {logs.map((log, index) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex gap-8 group"
                >
                  {/* Timeline Dot/Icon */}
                  <div className={`relative z-10 w-12 h-12 rounded-full border-4 border-white shadow-md flex items-center justify-center shrink-0 ${getIconBg(log.status)}`}>
                    {getIcon(log)}
                  </div>

                  <div className="flex-1 flex justify-between items-start bg-white rounded-2xl group-hover:bg-slate-50/50 transition-all p-2 -m-2">
                    <div className="flex gap-4">
                      {/* Avatar for user logs */}
                      {log.type !== 'system' && (
                        <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-slate-100 shadow-sm ${log.type === 'member' ? 'bg-emerald-50 flex items-center justify-center' : ''}`}>
                          {log.user?.photoURL ? (
                            <img src={log.user.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold">
                              {log.type === 'member' ? <UserPlus size={20} className="text-emerald-600" /> : log.user?.name.charAt(0)}
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
                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                          {log.type === 'member' && <span className="text-emerald-600">New Member Joined</span>}
                          {log.type === 'user' && <span>User: <span className="font-black text-indigo-950">{log.user?.name}</span></span>}
                          {log.type === 'admin' && <span>Admin: <span className="font-black text-indigo-950">{log.user?.name}</span></span>}
                          {log.type === 'system' && <span className="text-rose-600 font-extrabold">{log.action}</span>}
                        </h3>
                        {log.type !== 'system' && <p className="text-slate-700 font-bold">{log.action}</p>}
                        <p className="text-slate-500 font-medium">{log.details}</p>
                        {log.metadata && (
                          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{log.metadata}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-3">
                         {log.status === 'WARNING' && (
                          <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-200">
                            WARNING
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-400">{log.timestamp}</span>
                        {log.status !== 'WARNING' && (
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${getStatusStyles(log.status)}`}>
                            {log.status}
                          </span>
                        )}
                        {log.status === 'WARNING' && (
                          <span className="text-sm font-bold text-slate-400">{/* Empty just to match spacing */}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
