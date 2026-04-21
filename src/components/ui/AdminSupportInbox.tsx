import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, Send, X, Loader2,
  MessageSquare, ChevronLeft, User, Clock, Check, Zap,
  Phone, MoreVertical, Plus, Smile, Search, Bell,
  MapPin, Mail, Award, BookOpen
} from 'lucide-react';
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, where, getDocs, limit
} from 'firebase/firestore';
import { db, auth, logActivity } from '../../lib/firebase';
import { ChatSession, ChatMessage, Book, Transaction } from '../../types';
import toast from 'react-hot-toast';

export function AdminSupportInbox() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeUserTransactions, setActiveUserTransactions] = useState<Transaction[]>([]);
  const [activeUserBooks, setActiveUserBooks] = useState<Record<string, Book>>({});
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

    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(msgs);
      
      if (activeSession) {
        snap.docs.forEach(d => {
          if (d.data().senderRole === 'user' && !d.data().read) {
            updateDoc(doc(db, 'chat_messages', d.id), { read: true }).catch(console.error);
          }
        });
        updateDoc(doc(db, 'chat_sessions', activeSession.id), { unreadByAdmin: 0 }).catch(console.error);
        
        // Fetch user context (recent books/transactions)
        const transQ = query(
          collection(db, 'transactions'),
          where('userId', '==', activeSession.userId),
          orderBy('issueDate', 'desc'),
          limit(3)
        );
        const transSnap = await getDocs(transQ);
        const transList = transSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
        setActiveUserTransactions(transList);
        
        // Fetch book titles for transactions
        for (const t of transList) {
          if (!activeUserBooks[t.bookId]) {
            const bSnap = await getDocs(query(collection(db, 'books'), where('__name__', '==', t.bookId)));
            if (!bSnap.empty) {
              const bData = bSnap.docs[0].data() as Book;
              setActiveUserBooks(prev => ({ ...prev, [t.bookId]: bData }));
            }
          }
        }
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
                className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-all group relative ${
                  activeSession?.id === session.id ? 'bg-primary-accent/10' : getUrgencyColor(session.urgency, session.unreadByAdmin)
                }`}
              >
                {activeSession?.id === session.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-accent shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
                )}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-accent font-black text-sm">
                      {session.userName?.charAt(0).toUpperCase()}
                    </div>
                    {session.status === 'open' && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-dark ${getUrgencyDot(session.urgency, session.unreadByAdmin)}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-white uppercase tracking-tight truncate">{session.userName}</p>
                      <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                        {new Date(session.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-[10px] truncate mt-0.5 ${session.unreadByAdmin > 0 ? 'text-white font-bold' : 'text-slate-500'}`}>
                      {session.lastMessage || 'Started a conversation'}
                    </p>
                    {session.unreadByAdmin > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[8px] font-black bg-primary-accent text-white px-2 py-0.5 rounded-full">
                          {session.unreadByAdmin} NEW
                        </span>
                      </div>
                    )}
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
            <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0 h-16">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveSession(null)}
                  className="md:hidden p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-primary-accent/10 border border-primary-accent/20 flex items-center justify-center text-primary-accent font-black text-sm">
                    {activeSession.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#08080A]" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">{activeSession.userName}</p>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all border border-white/5">
                  <Phone size={16} />
                </button>
                <button className="p-2.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all border border-white/5">
                  <MoreVertical size={16} />
                </button>
                {activeSession.status === 'open' && (
                  <button
                    onClick={() => handleCloseSession(activeSession.id)}
                    className="ml-2 px-4 py-2 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                  >
                    Close Chat
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#08080A] flex flex-col">
              <div className="flex justify-center mb-4">
                <div className="px-4 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {messages.map((msg, index) => {
                const isSameSenderAsPrev = index > 0 && messages[index - 1].senderRole === msg.senderRole;
                const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={msg.id} className={`flex flex-col ${msg.senderRole === 'admin' ? 'items-end' : 'items-start'} ${isSameSenderAsPrev ? 'mt-1' : 'mt-6'}`}>
                    {!isSameSenderAsPrev && (
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="text-[10px] font-black text-white uppercase tracking-tight">
                          {msg.senderRole === 'admin' ? 'Luminia Agent' : msg.senderName}
                        </span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">{timeStr}</span>
                      </div>
                    )}
                    
                    <div className="flex items-end gap-2 group max-w-[75%]">
                      {msg.senderRole === 'admin' && (
                        <div className="flex flex-col items-end gap-1">
                           <div
                            className={`px-5 py-3 text-[13px] font-semibold leading-relaxed shadow-xl transition-all hover:scale-[1.01] text-white bg-primary-accent rounded-3xl ${isSameSenderAsPrev ? 'rounded-tr-md' : 'rounded-tr-sm'}`}
                            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}
                          >
                            {msg.text}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Check size={10} className={msg.read ? 'text-cyan-400' : 'text-white/20'} />
                             {msg.read && <Check size={10} className="text-cyan-400 -ml-1.5" />}
                          </div>
                        </div>
                      )}

                      {msg.senderRole === 'user' && (
                        <div
                          className={`px-5 py-3 text-[13px] font-semibold leading-relaxed shadow-xl transition-all hover:scale-[1.01] text-white bg-white/5 border border-white/10 rounded-3xl ${isSameSenderAsPrev ? 'rounded-tl-md' : 'rounded-tl-sm'}`}
                          style={{ backdropFilter: 'blur(12px)' }}
                        >
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-white/5 bg-white/[0.02] shrink-0">

              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-3xl p-1.5 pl-4 focus-within:ring-2 focus-within:ring-primary-accent/30 transition-all">
                <button className="p-2 text-slate-500 hover:text-white">
                  <Plus size={18} />
                </button>
                <input
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
                  className="w-10 h-10 flex items-center justify-center text-white rounded-2xl disabled:opacity-40 transition-all active:scale-95 shadow-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <p className="text-[9px] text-center text-slate-600 font-black uppercase tracking-widest">Our team is available Mon-Fri, 9am - 6pm EST</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
            <div className="w-20 h-20 rounded-[2.5rem] bg-primary-accent/10 flex items-center justify-center mb-6 border border-primary-accent/20">
              <MessageCircle size={40} className="text-primary-accent" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">Support Portal</h3>
            <p className="text-xs text-slate-500 font-black uppercase tracking-widest">Select a session to begin helping</p>
          </div>
        )}
      </div>

      {/* User Context Panel (Reference Column 3) */}
      {activeSession && (
        <div className="hidden xl:flex w-80 border-l border-white/5 flex-col bg-white/[0.01]">
          <div className="p-6 border-b border-white/5 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-primary-accent font-black text-2xl mb-4">
              {activeSession.userName?.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tight">{activeSession.userName}</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Premium Member</p>
          </div>

          <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Contact Info</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                    <Mail size={14} />
                  </div>
                  <p className="text-xs font-bold text-slate-300 truncate flex-1">{activeSession.userEmail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                    <MapPin size={14} />
                  </div>
                  <p className="text-xs font-bold text-slate-300">Library HQ, Main</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Membership</h4>
              <div className="p-4 bg-primary-accent/5 border border-primary-accent/10 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-accent/20 flex items-center justify-center text-primary-accent">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-tight">Lumina Pro</p>
                  <p className="text-[9px] text-primary-accent font-black uppercase tracking-widest mt-0.5">Active Subscription</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Recent Activity</h4>
              <div className="space-y-3">
                {activeUserTransactions.length === 0 ? (
                  <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest text-center py-4">No recent history</p>
                ) : (
                  activeUserTransactions.map(t => (
                    <div key={t.id} className="p-3 bg-white/5 border border-white/5 rounded-xl group hover:border-white/20 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary-accent shrink-0">
                          <BookOpen size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-white uppercase truncate">{activeUserBooks[t.bookId]?.title || 'Loading...'}</p>
                          <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{t.status}</p>
                        </div>
                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${t.status === 'borrowed' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>
                          {t.status === 'borrowed' ? 'In Hand' : 'Returned'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-white/[0.02] border-t border-white/5">
            <div className="p-4 bg-primary-accent/10 border border-primary-accent/20 rounded-2xl text-center">
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Pro Plan</p>
              <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Unlimited borrowing, zero fines & priority support enabled.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
