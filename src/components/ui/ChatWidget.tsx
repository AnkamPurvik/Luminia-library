import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, X, Send, Loader2, MinimizeIcon, ChevronDown, Check
} from 'lucide-react';
import {
  collection, addDoc, onSnapshot, query,
  where, orderBy, updateDoc, doc, setDoc, getDoc
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { ChatMessage } from '../../types';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const user = auth.currentUser;

  // Create or fetch existing chat session on open
  useEffect(() => {
    if (!isOpen || !user) return;

    const sessionRef = doc(db, 'chat_sessions', user.uid);
    getDoc(sessionRef).then(async (snap) => {
      if (!snap.exists()) {
        await setDoc(sessionRef, {
          userId: user.uid,
          userName: user.displayName || 'Member',
          userEmail: user.email || '',
          status: 'open',
          lastMessage: '',
          lastMessageAt: new Date().toISOString(),
          unreadByAdmin: 0,
          urgency: 'low',
          createdAt: new Date().toISOString()
        });
      }
      setSessionId(user.uid);
    });
  }, [isOpen, user]);

  // Subscribe to messages
  useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, 'chat_messages'),
      where('sessionId', '==', sessionId),
      orderBy('timestamp', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
      setMessages(msgs);

      // Count admin messages not read by user
      const newUnread = msgs.filter(m => m.senderRole === 'admin' && !m.read).length;
      if (!isOpen) setUnreadCount(newUnread);

      // Mark admin messages as read when open
      if (isOpen) {
        snap.docs.forEach(d => {
          if (d.data().senderRole === 'admin' && !d.data().read) {
            updateDoc(doc(db, 'chat_messages', d.id), { read: true });
          }
        });
        setUnreadCount(0);
      }
    });

    return () => unsub();
  }, [sessionId, isOpen]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !user || !sessionId || isSending) return;
    setIsSending(true);

    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'chat_messages'), {
        sessionId,
        senderId: user.uid,
        senderName: user.displayName || 'Member',
        senderRole: 'user',
        text,
        timestamp: new Date().toISOString(),
        read: false
      });

      // Haptic feedback on send
      if (navigator.vibrate) navigator.vibrate([10, 30]);

      // Update session meta
      await updateDoc(doc(db, 'chat_sessions', sessionId), {
        lastMessage: text,
        lastMessageAt: new Date().toISOString(),
        unreadByAdmin: (messages.filter(m => m.senderRole === 'user' && !m.read).length) + 1,
        status: 'open'
      });
    } catch (err) {
      console.error('Chat send error:', err);
    } finally {
      setIsSending(false);
      // Re-focus input on mobile
      inputRef.current?.focus();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
    // Haptic feedback on mobile
    if (navigator.vibrate) navigator.vibrate(40);
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3 max-sm:bottom-20 max-sm:right-4">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="w-[360px] sm:w-[400px] h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col relative chat-mobile-fullscreen"
            style={{
              background: 'rgba(8, 8, 10, 0.88)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            {/* Mesh gradient background */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                background:
                  'radial-gradient(ellipse at 20% 0%, rgba(99, 102, 241, 0.2) 0%, transparent 50%), ' +
                  'radial-gradient(ellipse at 80% 100%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
              }}
            />

            {/* Header */}
            <div className="relative z-10 p-5 border-b border-white/10 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(8,8,10,0.95))' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30">
                    <MessageCircle size={18} className="text-primary-accent" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#08080A] animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">Luminia Support</p>
                  <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <MinimizeIcon size={14} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages — flex-col-reverse on mobile for keyboard proximity */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative z-10 flex flex-col">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center flex-1 text-center opacity-50">
                  <div className="w-16 h-16 rounded-2xl bg-primary-accent/10 flex items-center justify-center mb-4 border border-primary-accent/20">
                    <MessageCircle size={28} className="text-primary-accent" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Start a conversation</p>
                  <p className="text-[10px] text-slate-600 font-bold mt-1">Our team usually replies within minutes</p>
                </div>
              )}
              <div className="flex-1" />
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm font-semibold leading-relaxed shadow-lg ${
                      msg.senderRole === 'user'
                        ? 'rounded-br-md text-white'
                        : 'rounded-bl-md text-white bg-[#1E293B] border border-white/10'
                    }`}
                    style={
                      msg.senderRole === 'user'
                        ? { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 24px rgba(99,102,241,0.3)' }
                        : {}
                    }
                  >
                    {msg.senderRole === 'admin' && (
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{msg.senderName}</p>
                    )}
                    <p>{msg.text}</p>
                    <div className="flex items-center justify-between gap-4 mt-1.5">
                      <p className={`text-[9px] ${msg.senderRole === 'user' ? 'text-white/50' : 'text-slate-600'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {msg.senderRole === 'user' && (
                        <div className="flex items-center gap-0.5">
                          <Check size={8} className={msg.read ? 'text-emerald-400' : 'text-white/30'} />
                          {msg.read && <Check size={8} className="text-emerald-400 -ml-1" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input — stays above keyboard on mobile */}
            <div className="relative z-10 p-4 border-t border-white/10 bg-white/[0.02] sticky bottom-0">
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-accent/30 focus:border-primary-accent/40 transition-all min-h-[48px]"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || isSending}
                  className="w-12 h-12 flex items-center justify-center text-white rounded-2xl hover:bg-indigo-500 disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-indigo-500/30 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        data-chat-fab
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-2xl flex items-center justify-center transition-all group"
        style={{
          background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
          boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
        }}
      >
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-2xl animate-pulse opacity-50"
          style={{ boxShadow: '0 0 24px 4px rgba(99,102,241,0.4)' }}
        />
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} className="text-white" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle size={24} className="text-white" />
            </motion.span>
          )}
        </AnimatePresence>
        {/* Unread badge */}
        {unreadCount > 0 && !isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-[10px] font-black border-2 border-bg-dark shadow-lg"
          >
            {unreadCount}
          </motion.div>
        )}
      </motion.button>
    </div>
  );
}
