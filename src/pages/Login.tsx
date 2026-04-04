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
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Left Side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 relative z-10">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-12 group w-fit">
            <div className="bg-indigo-600 p-2 rounded-xl group-hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              <Library className="text-white" size={24} />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">Lumina Library</span>
          </Link>

          <header className="mb-10">
            <h1 className="text-4xl font-black text-slate-900 mb-2 leading-tight">
              {isLogin ? 'Welcome Back' : 'Get Started'}
            </h1>
            <p className="text-slate-500 font-medium">
              {isLogin 
                ? 'Please enter your details to access your library account.' 
                : 'Join millions of readers and manage your book collection today.'}
            </p>
          </header>

          {/* Toggle Tab */}
          <div className="bg-slate-50 p-1.5 rounded-2xl flex mb-8 border border-slate-100">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                !isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Signup
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest px-1">Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-300 font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest px-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-11 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-300 font-medium"
                />
                {email && email.includes('@') && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Password</label>
                {isLogin && (
                  <button type="button" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Forgot?</button>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-300 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? 'Continue' : 'Create Account'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-10">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-100"></div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-xs font-bold text-slate-400 uppercase tracking-widest">Or Continue With</span>
            </div>
          </div>

          {/* Social Sign In */}
          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors group"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            <button className="flex items-center justify-center p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors group">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform fill-slate-900" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.96.95-2.05 1.44-3.26 1.44-1.22 0-2.21-.45-3.29-1.44-1.09-1.02-2.12-1.52-3.34-1.52-1.22 0-2.31.5-3.34 1.52-.96.95-1.99 1.44-3.21 1.44-1.22 0-2.26-.49-3.26-1.44-1-.95-1.5-2.07-1.5-3.35s.49-2.4 1.5-3.35c.96-.95 2.05-1.44 3.26-1.44 1.22 0 2.21.45 3.29 1.44 1.09 1.02 2.12 1.52 3.34 1.52 1.22 0 2.31-.5 3.34-1.52.96-.95 1.99-1.44 3.21-1.44 1.22 0 2.26.49 3.26 1.44 1 .95 1.5 2.07 1.5 3.35s-.5 2.4-1.5 3.35zM12 7.07c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
              </svg>
            </button>
            <button className="flex items-center justify-center p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors group">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform fill-blue-600" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
          </div>

          <footer className="mt-12 text-center">
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Join the millions of smart readers who trust us to manage their library. Log in to access your personalized book dashboard, track your reading history, and explore new titles.
            </p>
          </footer>
        </div>
      </div>

      {/* Right Side: Hero Illustration */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-50 to-white items-center justify-center relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-3xl"></div>
          <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-50/50 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10 p-12 flex flex-col items-center text-center"
        >
          <div className="relative group perspective-1000">
            <img 
              src={heroImage} 
              alt="Safe Illustration" 
              className="w-[110%] max-w-lg drop-shadow-2xl transition-transform duration-700 group-hover:rotate-y-12"
            />
            {/* Floating Elements */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl shadow-indigo-100/20 animate-bounce transition-all [animation-duration:3s]"></div>
            <div className="absolute -bottom-5 -left-10 w-16 h-16 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-lg shadow-indigo-100/20 animate-pulse transition-all [animation-duration:5s]"></div>
          </div>
          
          <div className="mt-12 space-y-4 max-w-sm">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Your Books, Safely Managed</h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              Experience the future of library management with Lumina Pro. Security, speed, and intelligence at your fingertips.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
