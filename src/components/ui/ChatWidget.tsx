import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, X, Send, Loader2, MinimizeIcon, ChevronDown, Check,
  Plus, Smile, Zap, BookOpen, Clock, Info, User, Phone, MoreVertical
} from 'lucide-react';
import {
  collection, addDoc, onSnapshot, query,
  where, orderBy, updateDoc, doc, setDoc, getDoc, getDocs
} from 'firebase/firestore';
import { db, auth, logActivity } from '../../lib/firebase';
import { ChatMessage } from '../../types';
import toast from 'react-hot-toast';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [session, setSession] = useState<any>(null);
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
    const unsub = onSnapshot(sessionRef, async (snap) => {
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
        // Log new session
        await logActivity({
          type: 'chat',
          user: { name: user.displayName || 'Member' },
          action: 'Started Support Chat',
          details: `User requested assistance. Session: ${user.uid}`,
          status: 'INFO'
        });
      } else {
        setSession({ id: snap.id, ...snap.data() });
        setSessionId(snap.id);
      }
    });
    return () => unsub();
  }, [isOpen, user]);

  // Subscribe to messages
  useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, 'chat_messages'),
      where('sessionId', '==', sessionId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
      // Sort messages locally by timestamp to replace the removed orderBy
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setMessages(msgs);

      // Count admin messages not read by user
      const newUnread = msgs.filter(m => m.senderRole === 'admin' && !m.read).length;
      if (!isOpen) setUnreadCount(newUnread);

      // Mark admin messages as read when open
      if (isOpen) {
        snap.docs.forEach(d => {
          if (d.data().senderRole === 'admin' && !d.data().read) {
            updateDoc(doc(db, 'chat_messages', d.id), { read: true }).catch(console.error);
          }
        });
        setUnreadCount(0);
      }
    }, (error) => {
      console.error("Chat subscription error:", error);
      if (error.code === 'permission-denied') {
        toast.error("Chat permission denied. Please re-login.");
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
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
      // Re-focus input on mobile
      inputRef.current?.focus();
    }
  };

  const handleQuickAction = async (action: string) => {
    if (!user || !sessionId || isSending) return;
    
    // Send the user's "message" (the button text)
    await addDoc(collection(db, 'chat_messages'), {
      sessionId,
      senderId: user.uid,
      senderName: user.displayName || 'Member',
      senderRole: 'user',
      text: action,
      timestamp: new Date().toISOString(),
      read: false
    });

    // Determine auto-reply
    let autoReply = "";
    switch (action) {
      case "CHECK LOAN STATUS":
        const q = query(collection(db, 'transactions'), where('userId', '==', user.uid), where('status', '==', 'borrowed'));
        const snap = await getDocs(q);
        const count = snap.size;
        const nextDue = snap.docs.length > 0 
          ? new Date(snap.docs[0].data().dueDate).toLocaleDateString()
          : "N/A";
        autoReply = `Checking... You currently have ${count} books out. Your next return is due on ${nextDue}.`;
        break;
      case "TALK TO HUMAN":
        autoReply = "I've alerted the admin. A librarian will be with you shortly. Current wait time: ~5 mins.";
        await updateDoc(doc(db, 'chat_sessions', sessionId), { urgency: 'high' });
        break;
      case "LIBRARY HOURS":
        autoReply = "We are open Mon-Fri, 9AM - 6PM EST. On weekends, we are open for digital downloads only.";
        break;
      case "LUMINA PRO PERKS":
        autoReply = "Lumina Pro members get unlimited renewals and early access to 'High Heat' titles. Would you like to see the upgrade options?";
        break;
    }

    if (autoReply) {
      // Simulate typing delay
      setTimeout(async () => {
        await addDoc(collection(db, 'chat_messages'), {
          sessionId,
          senderId: 'system-bot',
          senderName: 'Luminia AI',
          senderRole: 'admin',
          text: autoReply,
          timestamp: new Date().toISOString(),
          read: false
        });
      }, 800);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
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
            <div className="relative z-10 p-4 border-b border-white/10 flex items-center justify-between h-16 shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(8,8,10,0.98))' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-primary-accent/10 flex items-center justify-center border border-primary-accent/20 text-primary-accent font-black text-sm">
                    L
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#08080A] ${session?.status === 'open' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">Luminia Support</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${session?.status === 'open' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <span className={`w-1 h-1 rounded-full ${session?.status === 'open' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {session?.status === 'open' ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  <ChevronDown size={18} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative z-10 flex flex-col bg-[#08080A]">
               <div className="flex justify-center my-2">
                <div className="px-4 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {messages.map((msg, index) => {
                const isSameSenderAsPrev = index > 0 && messages[index - 1].senderRole === msg.senderRole;
                const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={msg.id} className={`flex flex-col ${msg.senderRole === 'user' ? 'items-end' : 'items-start'} ${isSameSenderAsPrev ? 'mt-1' : 'mt-6'}`}>
                    {!isSameSenderAsPrev && (
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="text-[10px] font-black text-white uppercase tracking-tight">
                          {msg.senderRole === 'admin' ? 'Support Agent' : 'You'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">{timeStr}</span>
                      </div>
                    )}
                    
                    <div className="max-w-[80%] group relative">
                       <div
                        className={`px-5 py-3 text-[13px] font-semibold leading-relaxed shadow-xl transition-all hover:scale-[1.01] text-white ${
                          msg.senderRole === 'user'
                            ? `bg-primary-accent rounded-3xl ${isSameSenderAsPrev ? 'rounded-tr-md' : 'rounded-tr-sm'}`
                            : `bg-white/5 border border-white/10 rounded-3xl ${isSameSenderAsPrev ? 'rounded-tl-md' : 'rounded-tl-sm'}`
                        }`}
                        style={
                          msg.senderRole === 'user'
                            ? { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }
                            : { backdropFilter: 'blur(12px)' }
                        }
                      >
                        {msg.text}
                      </div>
                      {msg.senderRole === 'user' && (
                        <div className="flex items-center gap-1 justify-end mt-1">
                           <Check size={10} className={msg.read ? 'text-emerald-400' : 'text-white/20'} />
                           {msg.read && <Check size={10} className="text-emerald-400 -ml-1.5" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input & Quick Actions */}
            <div className="relative z-10 p-4 border-t border-white/10 bg-white/[0.02] sticky bottom-0 space-y-4">
               {session?.status === 'open' && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {["CHECK LOAN STATUS", "TALK TO HUMAN", "LIBRARY HOURS", "LUMINA PRO PERKS"].map((action, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleQuickAction(action)} 
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-slate-400 hover:text-white hover:border-primary-accent/40 active:bg-primary-accent transition-all whitespace-nowrap uppercase tracking-widest"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}

              {session?.status === 'closed' ? (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-center">
                   <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">This conversation has been closed by an admin.</p>
                   <button 
                    onClick={async () => {
                      await updateDoc(doc(db, 'chat_sessions', user.uid), { status: 'open', lastMessageAt: new Date().toISOString() });
                      toast.success("Chat reopened");
                    }}
                    className="text-[9px] font-black text-primary-accent uppercase tracking-widest mt-2 hover:underline"
                   >
                    Reopen Chat
                   </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-3xl p-1.5 pl-4 focus-within:ring-2 focus-within:ring-primary-accent/30 transition-all">
                   <button className="p-2 text-slate-500 hover:text-white">
                    <Plus size={18} />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder="Type your message..."
                    className="flex-1 bg-transparent border-none text-sm font-semibold text-white placeholder-slate-600 focus:outline-none py-2"
                  />
                  <button className="p-2 text-slate-500 hover:text-white">
                    <Smile size={18} />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isSending}
                    className="w-10 h-10 flex items-center justify-center text-white rounded-2xl hover:bg-indigo-500 disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-indigo-500/30 shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
                  >
                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              )}
              <p className={`text-[9px] text-center font-black uppercase tracking-widest transition-colors ${session?.status === 'open' ? 'text-emerald-400' : 'text-slate-600'}`}>
                {session?.status === 'open' ? 'Our team is available & online now' : 'Our team is available Mon-Fri, 9am - 6pm EST'}
              </p>
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
