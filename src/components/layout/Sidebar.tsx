import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Library, LayoutDashboard, Shield, 
  History, Settings, LogOut, Search
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { UserProfile } from '../../types';
import toast from 'react-hot-toast';

interface SidebarProps {
  profile: UserProfile | null;
  isAdmin: boolean;
}

export function Sidebar({ profile, isAdmin }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
      toast.success('Signed out successfully');
    } catch (err) {
      toast.error('Failed to sign out');
    }
  };

  const navItems = [
    { label: 'Catalog', icon: Search, path: '/' },
    { label: 'My Dashboard', icon: LayoutDashboard, path: '/dashboard', authRequired: true },
    { label: 'Admin Console', icon: Shield, path: '/admin', adminRequired: true },
    { label: 'Activity Timeline', icon: History, path: '/admin/timeline', adminRequired: true },
    { label: 'Settings', icon: Settings, path: '/settings', authRequired: true },
  ];

  const filteredItems = navItems.filter(item => {
    if (item.adminRequired && !isAdmin) return false;
    if (item.authRequired && !profile) return false;
    return true;
  });

  return (
    <aside className="w-80 bg-slate-900/50 border-r border-white/5 p-8 flex flex-col gap-10 shadow-2xl relative overflow-hidden backdrop-blur-3xl shrink-0 h-screen sticky top-0">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-accent/10 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-accent/10 blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none" />

      <div className="flex items-center gap-3 z-10">
        <div className="bg-primary-accent p-2.5 rounded-[1rem] shadow-xl shadow-primary-accent/20">
          <Library className="text-white" size={24} />
        </div>
        <span className="text-2xl font-black text-white tracking-tighter uppercase">Luminia</span>
      </div>

      {/* Profile Small Card */}
      {profile && (
        <div className="glass-panel border-white/5 rounded-3xl p-5 flex items-center justify-between z-10 group hover:border-white/10 transition-all shadow-xl">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shadow-inner shrink-0">
              <img 
                src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4F46E5&color=fff`}
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-primary-accent uppercase tracking-widest truncate">
                {profile.role === 'admin' ? 'System Master' : 'Member'}
              </p>
              <p className="text-sm font-black text-white tracking-tight truncate">{profile.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col gap-2 z-10">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] ${
                isActive 
                  ? 'bg-primary-accent text-white shadow-xl shadow-primary-accent/20 border border-primary-accent/20' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto z-10">
        {profile && (
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] text-slate-500 hover:text-rose-400 hover:bg-rose-400/5 group"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            Sign Out
          </button>
        )}
      </div>
    </aside>
  );
}
