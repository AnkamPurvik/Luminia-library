import { Link, useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { Library, LayoutDashboard, Settings, LogOut, Search, User as UserIcon, Sparkles, ShieldCheck, History } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface NavbarProps {
  user: FirebaseUser | null;
  isAdmin: boolean;
  isPro?: boolean;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export function Navbar({ user, isAdmin, isPro, searchQuery, onSearchChange }: NavbarProps) {
  const location = useLocation();
  const handleLogout = () => auth.signOut();

  const navItems = [
    { label: 'Catalog', path: '/', icon: Search },
    { label: 'My Dashboard', path: '/dashboard', icon: LayoutDashboard, authRequired: true },
    { label: 'Admin', path: '/admin', icon: ShieldCheck, adminRequired: true },
    { label: 'Timeline', path: '/admin/timeline', icon: History, adminRequired: true },
  ];

  const filteredItems = navItems.filter(item => {
    if (item.adminRequired && !isAdmin) return false;
    if (item.authRequired && !user) return false;
    return true;
  });

  return (
    <nav className="bg-bg-dark/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <div className="bg-primary-accent p-2 rounded-xl group-hover:scale-110 transition-all shadow-lg shadow-primary-accent/20">
                <Library className="text-white" size={20} />
              </div>
              <span className="text-2xl font-black text-white tracking-tighter font-display hidden lg:block uppercase">Luminia Library</span>
            </Link>
            
            <div className="hidden md:ml-4 md:flex md:space-x-4">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-4 py-2 text-sm font-black uppercase tracking-[0.2em] rounded-lg transition-all ${
                      isActive
                        ? 'text-primary-accent bg-primary-accent/10 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} className="mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-8 flex items-center">
            <div className="relative w-full group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-primary-accent text-slate-500">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search collections..."
                className="block w-full pl-12 pr-4 py-3 border border-white/5 rounded-2xl leading-5 bg-white/5 placeholder-slate-500 text-white focus:outline-none focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/40 sm:text-sm transition-all shadow-inner"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-2xl transition-all group relative">
                  <div className="hidden md:flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white group-hover:text-primary-accent transition-colors uppercase tracking-tight">{user.displayName}</span>
                      {isPro && <Sparkles size={14} className="text-amber-400 fill-amber-400 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && <ShieldCheck size={10} className="text-secondary-accent" />}
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-secondary-accent' : 'text-slate-500'}`}>
                        {isAdmin ? 'System Admin' : 'Active Member'}
                      </span>
                    </div>
                  </div>
                  <div className={`h-11 w-11 rounded-2xl border flex items-center justify-center overflow-hidden shadow-2xl transition-all ${
                    isPro ? 'bg-amber-400/10 border-amber-400/50 ring-4 ring-amber-400/5' : 'bg-white/5 border-white/10'
                  }`}>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon size={20} className={isPro ? 'text-amber-400' : 'text-slate-400'} />
                    )}
                  </div>
                  {isAdmin && (
                    <div className="absolute -top-1 -right-1 bg-secondary-accent text-white p-1 rounded-lg border-2 border-bg-dark shadow-xl">
                      <ShieldCheck size={10} />
                    </div>
                  )}
                </Link>
                <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white bg-primary-accent hover:bg-primary-accent/90 shadow-lg shadow-primary-accent/20 transition-all active:scale-95"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
