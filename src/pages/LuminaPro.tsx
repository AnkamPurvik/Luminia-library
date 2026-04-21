import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, logActivity } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, CheckCircle2, ShieldCheck, Zap, 
  Clock, ArrowLeft, Loader2, CreditCard, Library,
  Smartphone, QrCode, Shield, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function LuminaPro() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'plan' | 'payment'>('plan');
  const [upiId, setUpiId] = useState('');

  const handleCheckout = () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('Please sign in to upgrade.');
      return;
    }
    setPaymentStep('payment');
  };

  const handleFinalPayment = async () => {
    if (!upiId || !upiId.includes('@')) {
      toast.error('Please enter a valid UPI ID (e.g., username@bank)');
      return;
    }

    setIsProcessing(true);
    const user = auth.currentUser;
    if (!user) return;

    // Simulate Payment Processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isPro: true
      });
      
      await logActivity({
        type: 'user',
        user: { name: user.displayName || 'Member' },
        action: 'Upgraded to Lumina Pro',
        details: `UPI Payment verified // Transaction ID: LMN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        status: 'SUCCESS'
      });

      setIsSuccess(true);
      toast.success('Payment Successful! Welcome to Pro.');
      
      // Redirect after 3s
      setTimeout(() => navigate('/dashboard'), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const features = [
    {
      icon: <Zap className="text-amber-500" />,
      title: "Unlimited Borrowing",
      desc: "Remove the 5-book limit and borrow as many titles as you want simultaneously."
    },
    {
      icon: <Clock className="text-emerald-500" />,
      title: "Priority Reservations",
      desc: "Pro users get a 30-minute priority window when high-demand books are returned."
    },
    {
      icon: <ShieldCheck className="text-indigo-500" />,
      title: "Extended Due Dates",
      desc: "Get 30 days instead of 14 for every book you borrow."
    },
    {
      icon: <Sparkles className="text-purple-500" />,
      title: "Zero Overdue Fines",
      desc: "Forget about penalty fees. Pro members enjoy a grace period on all titles."
    }
  ];

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-panel p-12 rounded-[3rem] shadow-2xl border border-white/5 flex flex-col items-center text-center max-w-md w-full"
        >
          <div className="w-20 h-20 bg-emerald-400/10 rounded-full flex items-center justify-center text-emerald-400 mb-6 border border-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.1)]">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Welcome to Pro</h1>
          <p className="text-slate-500 mb-10 text-xs font-bold uppercase tracking-widest leading-relaxed">Your account has been upgraded. You now have unlimited access to our entire catalog.</p>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 3, ease: "linear" }}
              className="h-full bg-emerald-500"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-4 uppercase font-black tracking-widest">Redirecting to Dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <button 
        onClick={() => paymentStep === 'payment' ? setPaymentStep('plan') : navigate(-1)}
        className="flex items-center gap-3 text-slate-500 hover:text-primary-accent font-black uppercase tracking-widest text-xs mb-12 transition-all group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        {paymentStep === 'payment' ? 'Change Plan' : 'Back to Library'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-amber-400/10 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-amber-400/20">
            <Sparkles size={14} /> Premium Access
          </div>
          <h1 className="text-5xl font-black text-white leading-tight uppercase tracking-tighter">
            Elevate Your Reading with <span className="text-primary-accent">Lumina Pro</span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed font-bold uppercase tracking-tight">
            Unlock the full potential of Lumina Library. No limits, just pure knowledge.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-8 glass-panel border-white/5 rounded-[2rem] hover:border-white/10 transition-all group hover:bg-white/[0.04]"
              >
                <div className="mb-6 group-hover:scale-110 transition-transform">{f.icon}</div>
                <h3 className="font-black text-white mb-2 uppercase tracking-tight text-sm">{f.title}</h3>
                <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-widest">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {paymentStep === 'plan' ? (
              <motion.div 
                key="plan"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-panel border-white/5 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 text-white opacity-5">
                  <Library size={120} />
                </div>
                
                <div className="relative">
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Annual Plan</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Best value for power readers</p>
                  </div>

                  <div className="flex items-baseline gap-3 mb-10">
                    <span className="text-6xl font-black text-white tracking-tighter">₹249</span>
                    <span className="text-slate-500 font-bold text-2xl line-through">₹499</span>
                    <span className="text-slate-500 font-black uppercase tracking-widest text-[10px] ml-2">/ month</span>
                  </div>

                  <div className="space-y-5 mb-12">
                    {[
                      "Unlimited book borrowing",
                      "Priority Reservation Window",
                      "Zero late fees for all titles",
                      "Premium UI status & badge",
                      "Early access to new arrivals"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-6 h-6 bg-primary-accent/10 text-primary-accent rounded-lg flex items-center justify-center border border-primary-accent/20">
                          <CheckCircle2 size={14} />
                        </div>
                        <span className="text-xs text-white font-black uppercase tracking-widest">{item}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={handleCheckout}
                    className="w-full py-5 bg-primary-accent text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-4 shadow-2xl hover:bg-primary-accent/90 active:scale-[0.98] shadow-primary-accent/20"
                  >
                    <CreditCard size={24} />
                    Continue to Payment
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-panel border-white/5 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden"
              >
                <div className="relative space-y-10">
                  <header>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter font-sans">UPI Gateway</h2>
                      <div className="px-3 py-1 bg-emerald-400/10 text-emerald-400 text-[8px] font-black rounded-lg border border-emerald-400/20 uppercase tracking-[0.2em]">Secure Node</div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Scan the dynamic QR or enter your UPI identity to synchronize payment.</p>
                  </header>

                  {/* QR Simulation */}
                  <div className="flex flex-col items-center">
                    <div className="p-6 bg-white rounded-[2rem] shadow-inner mb-6 relative group cursor-pointer">
                      <QrCode size={160} className="text-slate-900" />
                      <div className="absolute inset-0 bg-primary-accent/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2rem]">
                        <Smartphone size={48} className="text-primary-accent animate-bounce" />
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-[0.3em] flex items-center gap-2">
                       <Smartphone size={12} /> SCAN WITH ANY UPI APP
                    </p>
                  </div>

                  {/* Manual UPI Input */}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                        <Smartphone size={12} className="text-primary-accent" /> Manual Entry (VPA)
                      </label>
                      <input 
                        type="text"
                        placeholder="USERNAME@BANK"
                        className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl focus:ring-4 focus:ring-primary-accent/10 outline-none text-white font-black text-xs uppercase"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                      />
                    </div>
                    
                    <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl flex items-start gap-4">
                      <Shield size={18} className="text-secondary-accent flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-white font-black uppercase tracking-tight">Encrypted Transaction</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase leading-relaxed mt-1">256-bit SSL protection active. Your VPA identity is never stored raw.</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    disabled={isProcessing}
                    onClick={handleFinalPayment}
                    className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-4 shadow-2xl ${
                      isProcessing 
                        ? 'bg-white/5 text-slate-500 cursor-wait border border-white/5' 
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] shadow-emerald-500/20'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={24} className="animate-spin" />
                        Verifying Transaction...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={24} />
                        Verify & Upgrade
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="mt-8 flex items-center justify-center gap-6">
             <div className="flex items-center gap-2 grayscale group hover:grayscale-0 transition-all cursor-help">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
               <span className="text-[9px] font-black text-slate-600 group-hover:text-slate-400 uppercase tracking-widest">VISA SECURE</span>
             </div>
             <div className="flex items-center gap-2 grayscale group hover:grayscale-0 transition-all cursor-help">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
               <span className="text-[9px] font-black text-slate-600 group-hover:text-slate-400 uppercase tracking-widest">PCI COMPLIANT</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
