import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, Send, X, Loader2,
  MessageSquare, ChevronLeft, User, Clock, Check, Zap
} from 'lucide-react';
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, where
} from 'firebase/firestore';
import { db, auth, logActivity } from '../../lib/firebase';
import { ChatSession, ChatMessage } from '../../types';

export function AdminSupportInbox() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load all open sessions
  useEffect(() => {
    const q = query(
      collection(db, 'chat_sessions'),
      orderBy('lastMessageAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatSession[]);
    }, (err) => {
      console.error("Sessions snapshot error:", err);
    });
    return () => unsub();
  }, []);

  // Load messages for active session
  useEffect(() => {
    if (!activeSession) return;

    const q = query(
      collection(db, 'chat_messages'),
      where('sessionId', '==', activeSession.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
      // Sort locally
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(msgs);
      // Mark all user messages as read when admin sees them
      if (activeSession) {
        snap.docs.forEach(d => {
          if (d.data().senderRole === 'user' && !d.data().read) {
            updateDoc(doc(db, 'chat_messages', d.id), { read: true }).catch(console.error);
          }
        });
        // Reset unread count on session
        updateDoc(doc(db, 'chat_sessions', activeSession.id), { unreadByAdmin: 0 }).catch(console.error);
      }
    }, (err) => {
      console.error("Messages snapshot error:", err);
    });

    return () => unsub();
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeSession || isSending) return;
    setIsSending(true);
    const text = inputText.trim();
    setInputText('');
    try {
      await addDoc(collection(db, 'chat_messages'), {
        sessionId: activeSession.id,
        senderId: auth.currentUser?.uid,
        senderName: auth.currentUser?.displayName || 'Admin',
        senderRole: 'admin',
        text,
        timestamp: new Date().toISOString(),
        read: false
      });

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate([10, 30]);

      await updateDoc(doc(db, 'chat_sessions', activeSession.id), {
        lastMessage: text,
        lastMessageAt: new Date().toISOString()
      });

      // Log activity
      await logActivity({
        type: 'admin',
        user: { name: auth.currentUser?.displayName || 'Admin' },
        action: `Support Reply to ${activeSession.userName}`,
        details: `Session ID: ${activeSession.id}`,
        status: 'INFO'
      });
    } finally {
      setIsSending(false);
    }
  };

  const QUICK_REPLIES = [
    "Hello! How can I assist you today?",
    "Your book reservation has been confirmed.",
    "We've updated your loan deadline.",
    "Is there anything else you need help with?",
    "Thank you for using Luminia Support!"
  ];

  const handleQuickReply = (text: string) => {
    setInputText(text);
  };

  const handleCloseSession = async (sessionId: string) => {
    await updateDoc(doc(db, 'chat_sessions', sessionId), { status: 'closed' });
    if (activeSession?.id === sessionId) setActiveSession(null);
    
    // Log activity
    await logActivity({
      type: 'admin',
      user: { name: auth.currentUser?.displayName || 'Admin' },
      action: `Closed Support Session: ${sessionId}`,
      details: `Support query resolved for user.`,
      status: 'SUCCESS'
    });
  };

  const getUrgencyColor = (urgency: string, unread: number) => {
    if (unread > 3) return 'border-rose-500/40 bg-rose-500/5';
    if (urgency === 'high' || unread > 1) return 'border-amber-500/40 bg-amber-500/5';
    return 'border-white/5 bg-white/[0.02]';
  };

  const getUrgencyDot = (urgency: string, unread: number) => {
    if (unread > 3 || urgency === 'high') return 'bg-rose-500';
    if (unread > 1) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const openCount = sessions.filter(s => s.status === 'open').length;
  const totalUnread = sessions.reduce((acc, s) => acc + (s.unreadByAdmin || 0), 0);

  return (
    <div className="glass-panel border-white/5 rounded-3xl overflow-hidden shadow-2xl h-[600px] flex relative">
      {/* Mesh gradient background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background:
            'radial-gradient(ellipse at 10% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), ' +
            'radial-gradient(ellipse at 90% 100%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
        }}
      />

      {/* Sessions List */}
      <div className={`flex flex-col border-r border-white/5 transition-all relative z-10 ${activeSession ? 'hidden md:flex md:w-72' : 'w-full md:w-72'}`}>
        <div className="p-5 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-white text-xs uppercase tracking-widest">Support Inbox</h3>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-md uppercase">
                  {totalUnread} New
                </span>
              )}
              <span className="text-[9px] font-black bg-primary-accent/10 text-primary-accent px-2 py-0.5 rounded-md border border-primary-accent/20 uppercase">
                {openCount} Open
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-40">
              <MessageSquare size={32} className="text-slate-600 mb-3" />
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No active chats</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSession(session)}
                className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-all group border-l-2 min-h-[64px] ${
                  activeSession?.id === session.id ? 'bg-primary-accent/5 border-l-primary-accent' : getUrgencyColor(session.urgency, session.unreadByAdmin)
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-accent font-black text-xs">
                      {session.userName?.charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-bg-dark ${getUrgencyDot(session.urgency, session.unreadByAdmin)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">{session.userName}</p>
                      {session.unreadByAdmin > 0 && (
                        <span className="text-[9px] font-black bg-primary-accent text-white px-1.5 py-0.5 rounded-full shrink-0">
                          {session.unreadByAdmin}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{session.lastMessage || 'Started a conversation'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${session.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div className={`flex-1 flex flex-col transition-all relative z-10 ${!activeSession ? 'hidden md:flex' : 'flex'}`}>
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveSession(null)}
                  className="md:hidden p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-xl bg-primary-accent/10 border border-primary-accent/20 flex items-center justify-center text-primary-accent font-black text-xs">
                  {activeSession.userName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">{activeSession.userName}</p>
                  <p className="text-[10px] text-slate-500 font-bold hidden sm:block">{activeSession.userEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeSession.status === 'open' && (
                  <button
                    onClick={() => handleCloseSession(activeSession.id)}
                    className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all border border-white/10 min-h-[44px]"
                  >
                    Close Chat
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-bg-dark/50 flex flex-col">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-semibold leading-relaxed shadow-lg ${
                      msg.senderRole === 'admin'
                        ? 'rounded-br-md text-white'
                        : 'rounded-bl-md text-white bg-slate-800 border border-white/5'
                    }`}
                    style={
                      msg.senderRole === 'admin'
                        ? { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 24px rgba(99,102,241,0.2)' }
                        : { backdropFilter: 'blur(12px)' }
                    }
                  >
                    {msg.senderRole === 'user' && (
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{msg.senderName}</p>
                    )}
                    <p>{msg.text}</p>
                    <div className="flex items-center justify-between gap-4 mt-1.5">
                      <p className={`text-[9px] flex items-center gap-1 ${msg.senderRole === 'admin' ? 'text-white/50' : 'text-slate-600'}`}>
                        <Clock size={9} />
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {msg.senderRole === 'admin' && (
                        <div className="flex items-center gap-0.5">
                          <Check size={8} className={msg.read ? 'text-emerald-400' : 'text-white/30'} />
                          {msg.read && <Check size={8} className="text-emerald-400 -ml-1" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                  <User size={32} className="text-slate-600 mb-3" />
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No messages yet</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            {activeSession.status === 'open' && (
              <div className="px-4 py-2 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar shrink-0 bg-white/[0.01]">
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(reply)}
                    className="whitespace-nowrap px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:text-primary-accent hover:border-primary-accent/40 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Zap size={10} className="text-primary-accent" />
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {activeSession.status === 'open' && (
              <div className="p-4 border-t border-white/5 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder="Reply as admin..."
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-accent/30 focus:border-primary-accent/40 transition-all min-h-[48px]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isSending}
                    className="w-12 h-12 flex items-center justify-center text-white rounded-2xl disabled:opacity-40 transition-all active:scale-95 shadow-lg shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
                  >
                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
            <MessageCircle size={48} className="text-primary-accent mb-4" />
            <p className="text-sm font-black text-white uppercase tracking-widest">Select a conversation</p>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Choose a support session from the left panel</p>
          </div>
        )}
      </div>
    </div>
  );
}
