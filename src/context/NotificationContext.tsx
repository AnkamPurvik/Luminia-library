import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, 
  updateDoc, doc, deleteDoc, limit, addDoc, Timestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, AlertTriangle, Info, 
  AlertCircle, X, Bell, Volume2, VolumeX 
} from 'lucide-react';

export interface Notification {
  id: string;
  userId: string;           // UID of the recipient
  title: string;            // "Book Overdue", "Reservation Available", etc.
  message: string;          // Detailed message
  type: 'warning' | 'success' | 'info' | 'error' | 'critical';
  category: 'loan' | 'reservation' | 'system' | 'security' | 'inventory' | 'member';
  priority: 'high' | 'medium' | 'low';
  metadata?: {
    bookId?: string;
    transactionId?: string;
    reservationId?: string;
    fineAmount?: number;
    daysOverdue?: number;
    actionUrl?: string;     // Where to navigate when clicked
    actionLabel?: string;   // "View Book", "Pay Fine", etc.
  };
  isRead: boolean;
  isDismissed: boolean;
  createdAt: any;
  actions?: {
    primary?: { label: string; action: string; data?: any };
    secondary?: { label: string; action: string; data?: any };
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  sendNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'isDismissed'>) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Toast component for transient notifications with a premium design
const ToastNotification = ({ message, type, onClose }: { message: string; type: string; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle size={20} className="text-emerald-400" />,
    error: <AlertCircle size={20} className="text-rose-400" />,
    warning: <AlertTriangle size={20} className="text-amber-400" />,
    info: <Info size={20} className="text-blue-400" />
  };

  const borders = {
    success: 'border-emerald-500/30 bg-emerald-950/20',
    error: 'border-rose-500/30 bg-rose-950/20',
    warning: 'border-amber-500/30 bg-amber-950/20',
    info: 'border-blue-500/30 bg-blue-950/20'
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      className={`fixed top-20 right-4 z-50 glass-panel rounded-2xl p-4 min-w-[320px] shadow-2xl border ${
        borders[type as keyof typeof borders] || borders.info
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {icons[type as keyof typeof icons] || icons.info}
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-bold tracking-tight leading-snug">{message}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('notification_sound_enabled');
    return saved !== 'false';
  });

  const unreadCount = notifications.filter(n => !n.isRead && !n.isDismissed).length;

  useEffect(() => {
    localStorage.setItem('notification_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  // Audio notifier for new active alerts
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioContext.currentTime + 0.1); // A5
      
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio context blocked or unsupported.');
    }
  };

  // Listen for real-time notifications from Firestore
  useEffect(() => {
    let unsubscribe = () => {};
    
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribe) unsubscribe();
      
      if (!user) {
        setNotifications([]);
        return;
      }

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      let isInitialLoad = true;
      unsubscribe = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs
          .map(doc => {
            const data = doc.data();
            const isDismissed = data.isDismissed !== undefined ? data.isDismissed : false;
            if (isDismissed) return null;

            return {
              id: doc.id,
              userId: data.userId || '',
              title: data.title || (data.type === 'availability' ? 'Book Available' : 'Library Notification'),
              message: data.message || '',
              type: data.type || 'info',
              category: data.category || (data.type === 'availability' ? 'reservation' : 'system'),
              priority: data.priority || 'medium',
              metadata: data.metadata || {
                bookId: data.bookId || undefined,
                reservationId: data.reservationId || undefined,
                actionUrl: data.type === 'availability' ? `/book/${data.bookId}` : undefined,
                actionLabel: data.type === 'availability' ? 'Borrow Now' : undefined,
              },
              isRead: data.isRead !== undefined ? data.isRead : (data.read || false),
              isDismissed: false,
              createdAt: data.createdAt,
              actions: data.actions || undefined
            };
          })
          .filter(Boolean) as Notification[];

        // Play sound if a new unread notification arrives (after initial mount load)
        if (!isInitialLoad && notifs.length > notifications.length) {
          const hasNewUnread = notifs.some(
            n => !n.isRead && !notifications.some(existing => existing.id === n.id)
          );
          if (hasNewUnread) {
            playAlertSound();
          }
        }
        isInitialLoad = false;
        setNotifications(notifs);
      }, (err) => {
        console.error('Firestore notification stream failed:', err);
      });
    });

    return () => {
      unsubAuth();
      if (unsubscribe) unsubscribe();
    };
  }, [soundEnabled, notifications.length]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        isRead: true,
        read: true,
        readAt: new Date()
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = notifications
        .filter(n => !n.isRead)
        .map(n => 
          updateDoc(doc(db, 'notifications', n.id), { 
            isRead: true, 
            read: true,
            readAt: new Date() 
          })
        );
      await Promise.all(batch);
      showToast('All alerts marked as read!', 'success');
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        isDismissed: true,
        isRead: true,
        read: true,
        dismissedAt: new Date()
      });
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      showToast('Alert permanently removed.', 'info');
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const batch = notifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
      await Promise.all(batch);
      showToast('All active alerts cleared.', 'success');
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const sendNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'isDismissed'>) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: new Date(),
        isRead: false,
        isDismissed: false
      });
    } catch (err) {
      console.error('Error dispatching custom notification:', err);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      soundEnabled,
      setSoundEnabled,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      deleteNotification,
      clearAllNotifications,
      sendNotification,
      showToast
    }}>
      {children}
      <AnimatePresence>
        {toasts.map(t => (
          <ToastNotification
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
          />
        ))}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
