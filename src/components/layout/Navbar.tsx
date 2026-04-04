import { Link, useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { Library, LayoutDashboard, Settings, LogOut, Search, User as UserIcon, Sparkles, ShieldCheck } from 'lucide-react';
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
    { label: 'Admin', path: '/admin', icon: Settings, adminRequired: true },
  ];

  const filteredItems = navItems.filter(item => {
    if (item.adminRequired && !isAdmin) return false;
    if (item.authRequired && !user) return false;
    return true;
  });

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <div className="bg-indigo-600 p-1.5 rounded-lg group-hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100">
                <Library className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight font-display hidden lg:block">Lumina Library</span>
            </Link>
            
            <div className="hidden md:ml-4 md:flex md:space-x-4">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={18} className="mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-4 flex items-center">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search catalog..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/dashboard" className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-2xl transition-colors group relative">
                  <div className="hidden md:flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user.displayName}</span>
                      {isPro && <Sparkles size={14} className="text-amber-500 fill-amber-500 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && <ShieldCheck size={10} className="text-indigo-500" />}
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {isAdmin ? 'Administrator' : 'Member'}
                      </span>
                    </div>
                  </div>
                  <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center overflow-hidden shadow-sm transition-all ${
                    isPro ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100' : 'bg-indigo-50 border-indigo-200'
                  }`}>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon size={20} className={isPro ? 'text-amber-600' : 'text-indigo-600'} />
                    )}
                  </div>
                  {isAdmin && (
                    <div className="absolute -top-1 -right-1 bg-indigo-600 text-white p-1 rounded-full border-2 border-white shadow-lg">
                      <ShieldCheck size={10} />
                    </div>
                  )}
                </Link>
                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
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
