import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, Notification } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, CheckCheck, Trash2, BookOpen, Calendar, 
  Shield, Package, Users, Info, ExternalLink, X, AlertTriangle 
} from 'lucide-react';
import { formatTimeDistance } from '../components/NotificationBell';

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAllNotifications 
  } = useNotifications();
  
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'loan': return <BookOpen size={18} className="text-emerald-400" />;
      case 'reservation': return <Calendar size={18} className="text-cyan-400" />;
      case 'security': return <Shield size={18} className="text-rose-400" />;
      case 'inventory': return <Package size={18} className="text-amber-400" />;
      case 'member': return <Users size={18} className="text-blue-400" />;
      default: return <Info size={18} className="text-slate-400" />;
    }
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-rose-500 border-l-4';
      case 'medium': return 'border-l-amber-500 border-l-4';
      default: return 'border-l-blue-500 border-l-4';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const handleNotificationAction = (notif: Notification) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    if (notif.metadata?.actionUrl) {
      navigate(notif.metadata.actionUrl);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header section */}
      <header className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
            <div className="bg-primary-accent p-3 rounded-2xl shadow-xl shadow-primary-accent/20">
              <Bell size={32} className="text-white" />
            </div>
            Inbox Alerts
          </h1>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mt-3 pl-1">
            Stay updated with secure library activities and critical notifications
          </p>
        </div>
      </header>

      {/* Filters & Bulk Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white/5 border border-white/5 p-4 rounded-2xl shadow-inner">
        {/* Left Filters */}
        <div className="flex gap-2">
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                filter === f 
                  ? 'bg-primary-accent text-white shadow-lg shadow-primary-accent/20' 
                  : 'bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {f === 'all' ? 'All Alerts' : f === 'unread' ? 'Unread' : 'Read'}
            </button>
          ))}
        </div>
        
        {/* Right Bulk Buttons */}
        <div className="flex gap-3 w-full sm:w-auto">
          {notifications.some(n => !n.isRead) && (
            <button
              onClick={markAllAsRead}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/5 hover:border-primary-accent/30 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all shadow-md"
            >
              <CheckCheck size={13} />
              Mark All Read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Delete all alerts? This action is permanent.')) {
                  clearAllNotifications();
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-400 transition-all shadow-md"
            >
              <Trash2 size={13} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel rounded-2xl p-16 text-center border border-white/5 flex flex-col items-center justify-center"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Bell size={28} className="text-slate-600 animate-pulse" />
              </div>
              <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No alerts found</p>
              <p className="text-slate-600 text-[10px] mt-1.5 uppercase font-medium tracking-wide">You are fully caught up with the catalog!</p>
            </motion.div>
          ) : (
            filteredNotifications.map((notif, index) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.04 }}
                className={`glass-panel rounded-2xl p-5 border transition-all relative flex gap-4 ${
                  !notif.isRead 
                    ? 'border-primary-accent/25 bg-primary-accent/[0.01]' 
                    : 'border-white/5 opacity-60 hover:opacity-90'
                } ${getPriorityBorder(notif.priority)}`}
              >
                {/* Category Icon */}
                <div className="shrink-0 mt-0.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                    {getCategoryIcon(notif.category)}
                  </div>
                </div>
                
                {/* Core Text Section */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <h3 className={`text-base font-black uppercase tracking-tight ${
                        !notif.isRead ? 'text-white' : 'text-slate-400'
                      }`}>
                        {notif.title}
                      </h3>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-lg">
                        {formatTimeDistance(notif.createdAt)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Fine Badge if applicable */}
                  {notif.metadata?.fineAmount && (
                    <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <span className="text-rose-400 text-[9px] font-black uppercase tracking-widest">
                        Fine Accrued: ₹{notif.metadata.fineAmount}
                      </span>
                    </div>
                  )}

                  {/* Metadata labels if exist */}
                  {notif.metadata?.daysOverdue && (
                    <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl ml-2">
                      <span className="text-amber-400 text-[9px] font-black uppercase tracking-widest">
                        Overdue: {notif.metadata.daysOverdue} Days
                      </span>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-white/5">
                    {!notif.isRead && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-[9px] font-black uppercase tracking-widest text-primary-accent hover:underline transition-colors flex items-center gap-1"
                      >
                        <CheckCheck size={11} />
                        Mark as read
                      </button>
                    )}
                    {notif.metadata?.actionUrl && (
                      <button
                        onClick={() => handleNotificationAction(notif)}
                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
                      >
                        <ExternalLink size={11} />
                        {notif.metadata.actionLabel || 'View Details'}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Delete Button */}
                <button
                  onClick={() => deleteNotification(notif.id)}
                  className="text-slate-500 hover:text-rose-500 transition-colors self-start mt-0.5 p-1 rounded-lg hover:bg-white/5"
                  title="Delete Alert"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
