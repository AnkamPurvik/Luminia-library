import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, CheckCheck, Trash2, X, ExternalLink, 
  Volume2, VolumeX, Shield, Package, Users, 
  BookOpen, Calendar, Info 
} from 'lucide-react';
import { useNotifications, Notification } from '../context/NotificationContext';

export function formatTimeDistance(dateInput: any): string {
  if (!dateInput) return 'just now';
  
  let date: Date;
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return 'just now';
  
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'bg-rose-500 shadow-rose-500/40';
    case 'medium': return 'bg-amber-500 shadow-amber-500/40';
    default: return 'bg-blue-500 shadow-blue-500/40';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'loan': return <BookOpen size={16} className="text-emerald-400" />;
    case 'reservation': return <Calendar size={16} className="text-cyan-400" />;
    case 'security': return <Shield size={16} className="text-rose-400" />;
    case 'inventory': return <Package size={16} className="text-amber-400" />;
    case 'member': return <Users size={16} className="text-blue-400" />;
    default: return <Info size={16} className="text-slate-400" />;
  }
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    notifications, 
    unreadCount, 
    soundEnabled,
    setSoundEnabled,
    markAsRead, 
    markAllAsRead, 
    dismissNotification, 
    clearAllNotifications 
  } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    
    // Handle navigation if action URL exists
    if (notif.metadata?.actionUrl) {
      navigate(notif.metadata.actionUrl);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 glass-panel rounded-2xl border-white/5 hover:border-primary-accent/30 hover:bg-white/10 transition-all group shadow-lg"
      >
        <Bell size={20} className="text-slate-400 group-hover:text-primary-accent transition-colors" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center border border-bg-dark shadow-lg shadow-rose-500/25"
          >
            <span className="text-white text-[9px] font-black">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </motion.div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="absolute right-0 mt-3 w-[400px] glass-panel rounded-2xl border-white/10 shadow-2xl overflow-hidden z-50 flex flex-col border bg-bg-dark/95 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black uppercase tracking-wider text-[10px]">Inbox Alerts</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-accent/20 border border-primary-accent/30 text-primary-accent text-[8px] font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Audio Enable Toggle */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="text-slate-500 hover:text-white transition-colors"
                  title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
                >
                  {soundEnabled ? <Volume2 size={14} className="text-primary-accent" /> : <VolumeX size={14} />}
                </button>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-primary-accent transition-colors flex items-center gap-1.5"
                  >
                    <CheckCheck size={12} />
                    All Read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors ml-1"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5">
              {notifications.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Bell size={20} className="text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Inbox Clean</p>
                  <p className="text-slate-600 text-[9px] mt-1 uppercase tracking-wide font-medium">All cleared!</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`p-4 hover:bg-white/[0.02] transition-all cursor-pointer group relative flex gap-3 ${
                      !notif.isRead ? 'bg-primary-accent/[0.03]' : ''
                    }`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    {/* Left Priority Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 transition-all group-hover:w-1 ${getPriorityColor(notif.priority)}`} />

                    {/* Category Icon */}
                    <div className="shrink-0 mt-0.5">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                        {getCategoryIcon(notif.category)}
                      </div>
                    </div>

                    {/* Core Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-[11px] font-black uppercase tracking-tight truncate ${
                          !notif.isRead ? 'text-white' : 'text-slate-400'
                        }`}>
                          {notif.title}
                        </h4>
                        <span className="text-[8px] text-slate-500 font-bold shrink-0">
                          {formatTimeDistance(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed break-words pr-2">
                        {notif.message}
                      </p>

                      {/* Action trigger if exists */}
                      {notif.metadata?.actionLabel && (
                        <div className="mt-2.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary-accent group-hover:underline">
                          <ExternalLink size={10} />
                          {notif.metadata.actionLabel}
                        </div>
                      )}
                    </div>

                    {/* Dismiss Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notif.id);
                      }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-rose-500 self-start mt-0.5"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer Clear All */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-white/5 bg-white/[0.01]">
                <button
                  onClick={() => {
                    if (window.confirm('Clear all active inbox alerts?')) {
                      clearAllNotifications();
                    }
                  }}
                  className="w-full py-2 bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 transition-all flex items-center justify-center gap-2 border border-white/5"
                >
                  <Trash2 size={11} />
                  Clear All Alerts
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
