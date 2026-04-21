import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Loader2, Library, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import heroImage from '../assets/login-hero.png';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) navigate('/dashboard');
    });
    return () => unsub();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });
        toast.success('Account created successfully!');
      }
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Signed in with Google!');
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      toast.error('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-bg-dark font-sans overflow-hidden">
      {/* Left Side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 relative z-10">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-4 mb-12 group w-fit">
            <div className="bg-primary-accent p-2.5 rounded-2xl group-hover:scale-110 transition-all shadow-xl shadow-primary-accent/20">
              <Library className="text-white" size={24} />
            </div>
            <span className="text-3xl font-black text-white tracking-tighter uppercase">Luminia</span>
          </Link>

          <header className="mb-10">
            <h1 className="text-5xl font-black text-white mb-4 leading-tight tracking-tighter uppercase">
              {isLogin ? 'Login' : 'Sign Up'}
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              {isLogin 
                ? 'Enter your credentials to access your library account.' 
                : 'Create a new account to get started.'}
            </p>
          </header>

          {/* Toggle Tab */}
          <div className="bg-white/5 p-1.5 rounded-2xl flex mb-10 border border-white/5 shadow-inner">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${
                isLogin ? 'bg-primary-accent text-white shadow-lg shadow-primary-accent/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${
                !isLogin ? 'bg-primary-accent text-white shadow-lg shadow-primary-accent/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary-accent transition-colors">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ENTER FULL NAME"
                    className="block w-full pl-14 pr-6 py-4 bg-white/5 border border-white/5 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 outline-none transition-all placeholder:text-slate-700 text-white font-black text-xs uppercase tracking-widest"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary-accent transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="NAME@RESOURCES.COM"
                  className="block w-full pl-14 pr-12 py-4 bg-white/5 border border-white/5 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 outline-none transition-all placeholder:text-slate-700 text-white font-black text-xs uppercase tracking-widest"
                />
                {email && email.includes('@') && (
                  <div className="absolute inset-y-0 right-0 pr-5 flex items-center">
                    <CheckCircle2 size={18} className="text-secondary-accent" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Password</label>
                {isLogin && (
                  <button type="button" className="text-[10px] font-black uppercase tracking-widest text-primary-accent hover:text-primary-accent/80 transition-colors">Forgot Password</button>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary-accent transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-14 pr-6 py-4 bg-white/5 border border-white/5 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 outline-none transition-all placeholder:text-slate-700 text-white font-black text-xs uppercase tracking-widest"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-accent hover:bg-primary-accent/90 text-white py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all shadow-xl shadow-primary-accent/20 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {isLogin ? 'Login' : 'Sign Up'}
                  <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-12">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/5"></div>
            <div className="relative flex justify-center">
              <span className="px-6 bg-bg-dark text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Social Sign In</span>
            </div>
          </div>

          {/* Social Sign In */}
          <div className="grid grid-cols-3 gap-6">
            <button 
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center py-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group shadow-inner"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4F46E5"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#4F46E5" opacity="0.8"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#4F46E5" opacity="0.6"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 12 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#4F46E5" opacity="0.4"/>
              </svg>
            </button>
            <button className="flex items-center justify-center py-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group shadow-inner">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform fill-slate-400 group-hover:fill-white" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.96.95-2.05 1.44-3.26 1.44-1.22 0-2.21-.45-3.29-1.44-1.09-1.02-2.12-1.52-3.34-1.52-1.22 0-2.31.5-3.34 1.52-.96.95-1.99 1.44-3.21 1.44-1.22 0-2.26-.49-3.26-1.44-1-.95-1.5-2.07-1.5-3.35s.49-2.4 1.5-3.35c.96-.95 2.05-1.44 3.26-1.44 1.22 0 2.21.45 3.29 1.44 1.09 1.02 2.12 1.52 3.34 1.52 1.22 0 2.31-.5 3.34-1.52.96-.95 1.99-1.44 3.21-1.44 1.22 0 2.26.49 3.26 1.44 1 .95 1.5 2.07 1.5 3.35s-.5 2.4-1.5 3.35zM12 7.07c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
              </svg>
            </button>
            <button className="flex items-center justify-center py-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group shadow-inner">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform fill-slate-400 group-hover:fill-secondary-accent" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
          </div>

          <footer className="mt-16 text-center">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
              Secure authentication enabled. Your account data is protected with industry-standard encryption.
            </p>
          </footer>
        </div>
      </div>

      {/* Right Side: Hero Illustration */}
      <div className="hidden lg:flex w-1/2 bg-surface-dark items-center justify-center relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-[20%] -left-[20%] w-[60%] h-[60%] rounded-full bg-primary-accent/10 blur-[120px] animate-pulse"></div>
          <div className="absolute top-[50%] -right-[20%] w-[60%] h-[60%] rounded-full bg-secondary-accent/5 blur-[120px]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.05]" style={{backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '60px 60px'}}></div>
          
          {/* Technical Grid Overlay */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)", backgroundSize: "100px 100px" }}></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10 p-12 flex flex-col items-center text-center w-full max-w-2xl"
        >
          <div className="relative group Perspective-1000">
            <div className="absolute inset-0 bg-primary-accent/20 blur-3xl rounded-full animate-pulse group-hover:bg-primary-accent/40 transition-colors"></div>
            <img 
              src={heroImage} 
              alt="System Illustration" 
              className="w-full h-auto drop-shadow-[0_35px_35px_rgba(79,70,229,0.25)] transition-transform duration-1000 group-hover:rotate-y-6 relative z-10"
            />
            {/* Floating Elements */}
            <div className="absolute -top-12 -right-12 w-32 h-32 glass-panel rounded-3xl animate-bounce transition-all [animation-duration:4s] flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-primary-accent/20 border border-primary-accent/50 animate-pulse"></div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-24 h-24 glass-panel rounded-2xl animate-pulse transition-all [animation-duration:6s] border-white/20"></div>
          </div>
          
          <div className="mt-20 space-y-6">
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Integrated Library<br/><span className="text-primary-accent">Luminia Pro</span></h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs leading-relaxed max-w-sm mx-auto">
              Enhance your reading experience with our advanced library catalog.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
