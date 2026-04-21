import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, BookOpen, Library, MessageCircle, Shield } from 'lucide-react';
import { UserProfile } from '../../types';

interface MobileNavProps {
  profile: UserProfile | null;
  isAdmin: boolean;
}

export function MobileNav({ profile, isAdmin }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Four clear navigation items for mobile
  const navItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Catalog', icon: Library, path: '/', catalogFocus: true },
    ...(profile
      ? [
          { label: 'My Books', icon: BookOpen, path: '/dashboard' },
          isAdmin
            ? { label: 'Admin', icon: Shield, path: '/admin' }
            : { label: 'Support', icon: MessageCircle, path: '#support' },
        ]
      : []),
  ];

  const handleNav = (item: typeof navItems[0]) => {
    // Haptic feedback on mobile
    if (navigator.vibrate) navigator.vibrate(30);

    if ('catalogFocus' in item && item.catalogFocus) {
      // Navigate to catalog/home and scroll down past hero
      navigate('/');
      setTimeout(() => {
        const catalogEl = document.querySelector('[data-catalog]');
        catalogEl?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    if (item.path === '#support') {
      // Toggle chat widget
      const chatFab = document.querySelector('[data-chat-fab]') as HTMLButtonElement;
      chatFab?.click();
      return;
    }

    navigate(item.path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[150] flex items-center justify-around px-2"
      style={{
        background: 'rgba(2, 2, 3, 0.92)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingTop: '8px',
        minHeight: '64px',
      }}
    >
      {navItems.map((item) => {
        const isActive =
          item.path === '#support'
            ? false
            : 'catalogFocus' in item
              ? false
              : location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));

        return (
          <button
            key={item.label}
            onClick={() => handleNav(item)}
            className="relative flex flex-col items-center gap-1 px-4 py-2 min-w-[56px] min-h-[48px] justify-center transition-all active:scale-90 rounded-2xl group"
            style={{
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Active glow background */}
            {isActive && (
              <motion.div
                layoutId="mobileNavActive"
                className="absolute inset-0 rounded-2xl glow-active"
                style={{
                  background: 'rgba(99,102,241,0.15)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {/* Icon */}
            <div className="relative z-10">
              <item.icon
                size={22}
                className={`transition-all duration-300 ${
                  isActive ? 'text-primary-accent' : 'text-slate-500 group-active:text-slate-300'
                }`}
                style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.8))' } : {}}
              />
            </div>

            {/* Label */}
            <span
              className={`text-[9px] font-black uppercase tracking-widest z-10 transition-all duration-300 ${
                isActive ? 'text-primary-accent' : 'text-slate-600'
              }`}
            >
              {item.label}
            </span>

            {/* Active indicator dot */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 w-1 h-1 rounded-full bg-primary-accent"
                  style={{ boxShadow: '0 0 8px rgba(99,102,241,0.9)' }}
                />
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </nav>
  );
}
