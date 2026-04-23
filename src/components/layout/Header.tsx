import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, Sparkles, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../types';

interface HeaderProps {
  profile: UserProfile | null;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export function Header({ profile, searchQuery, onSearchChange }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const navigate = useNavigate();

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Sync local search with global search (e.g. when cleared from outside)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 md:h-24 bg-bg-dark/50 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-4 md:px-10 sticky top-0 z-40 transition-all">
      <div className="flex-1 max-w-2xl">
        <div className="relative group transition-all">
          <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-accent transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search catalog..."
            className="w-full pl-10 md:pl-14 pr-4 md:pr-6 py-2 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase tracking-widest text-white focus:outline-none focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 transition-all shadow-inner"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-10">
        {/* Digital Clock */}
        <div className="hidden lg:flex flex-col items-end">
          <div className="flex items-center gap-2 text-primary-accent">
            <Clock size={16} className="animate-pulse" />
            <span className="text-lg font-black tracking-tighter uppercase whitespace-nowrap">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        <div className="hidden md:block h-8 w-px bg-white/10" />

        {/* User Status */}
        {profile ? (
          <div className="flex items-center gap-3 md:gap-4">
            <div className="text-right hidden md:block">
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm font-black text-white tracking-tight uppercase whitespace-nowrap">{profile.name}</span>
                {profile.isPro && <Sparkles size={14} className="text-amber-400 fill-amber-400 animate-pulse" />}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                {profile.role === 'admin' && <ShieldCheck size={10} className="text-secondary-accent" />}
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${profile.role === 'admin' ? 'text-secondary-accent' : 'text-slate-500'}`}>
                  {profile.role === 'admin' ? 'Library Administrator' : 'Archive Member'}
                </span>
              </div>
            </div>
            <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl border flex items-center justify-center overflow-hidden shadow-2xl transition-all ${
              profile.isPro ? 'bg-amber-400/10 border-amber-400/50 ring-4 ring-amber-400/10' : 'bg-white/5 border-white/10'
            }`}>
              <img 
                src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4F46E5&color=fff`} 
                alt="" 
                className="h-full w-full object-cover" 
              />
            </div>
          </div>
        ) : (
          <button 
            onClick={() => navigate('/login')}
            className="bg-primary-accent text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary-accent/20"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}
