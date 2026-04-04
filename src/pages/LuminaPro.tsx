import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, CheckCircle2, ShieldCheck, Zap, 
  Clock, ArrowLeft, Loader2, CreditCard, Library 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function LuminaPro() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCheckout = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('Please sign in to upgrade.');
      return;
    }

    setIsProcessing(true);
    
    // Simulate Payment Processing
    await new Promise(resolve => setTimeout(resolve, 2500));

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isPro: true
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
          className="bg-white p-12 rounded-3xl shadow-2xl border border-emerald-100 flex flex-col items-center text-center max-w-md w-full"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 font-display">Welcome to Pro!</h1>
          <p className="text-slate-500 mb-8">Your account has been upgraded. You now have unlimited access to our entire catalog.</p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
    <div className="max-w-5xl mx-auto px-4 py-16">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold mb-12 transition-colors group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        Back to Library
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-xs font-black uppercase tracking-widest">
            <Sparkles size={16} /> Premium Access
          </div>
          <h1 className="text-5xl font-black text-slate-900 leading-tight font-display">
            Elevate Your Reading with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Lumina Pro</span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed">
            Join thousands of enthusiastic readers who have unlocked the full potential of Lumina Library. No limits, just pure knowledge.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-3">{f.icon}</div>
                <h3 className="font-bold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-slate-50 opacity-5">
            <Library size={120} />
          </div>
          
          <div className="relative">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900">Annual Plan</h2>
              <p className="text-slate-500 text-sm">Best value for power readers</p>
            </div>

            <div className="flex items-baseline gap-2 mb-10">
              <span className="text-5xl font-black text-slate-900">₹249</span>
              <span className="text-slate-400 font-bold text-xl line-through">₹499</span>
              <span className="text-slate-500 font-medium">/ month</span>
              <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded uppercase">50% Off</span>
            </div>

            <div className="space-y-4 mb-10">
               {[
                 "Unlimited book borrowing",
                 "30-minute Priority Reservation Access",
                 "Zero late fees for all titles",
                 "Premium UI status & badge",
                 "Early access to new arrivals"
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-3">
                   <div className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                     <CheckCircle2 size={12} />
                   </div>
                   <span className="text-sm text-slate-700 font-medium">{item}</span>
                 </div>
               ))}
            </div>

            <button 
              disabled={isProcessing}
              onClick={handleCheckout}
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl ${
                isProcessing 
                  ? 'bg-slate-100 text-slate-400 cursor-wait' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-100'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <CreditCard size={24} />
                  Upgrade Now
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-4 font-medium italic">
              Secure payment processed via Lumina Gateway. Local taxes may apply.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
