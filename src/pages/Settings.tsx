import { useState, useEffect } from 'react';
import { auth, db, logActivity } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion } from 'motion/react';
import { 
  Settings as SettingsIcon, Bell, Shield, Eye, Palette, 
  Smartphone, Github, Globe, User, Save, Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UserProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, setTheme } = useTheme();
  
  // Local state for settings
  const [settings, setSettings] = useState({
    notifications: true,
    publicProfile: true,
    darkMode: true,
    emailUpdates: false
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    
    try {
      // Simulate saving settings
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await logActivity({
        type: 'user',
        user: { name: profile?.name || 'User' },
        action: 'Updated system configuration',
        details: 'User interface preferences and sync markers updated successfully.',
        status: 'SUCCESS'
      });
      
      toast.success('System preferences updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to sync settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-primary-accent animate-spin mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Syncing Preferences...</p>
      </div>
    );
  }

  const themeColors: { label: string; value: any }[] = [
    { label: 'Indigo', value: 'indigo' },
    { label: 'Cyan', value: 'cyan' },
    { label: 'Rose', value: 'rose' },
    { label: 'Emerald', value: 'emerald' },
    { label: 'Amber', value: 'amber' },
    { label: 'Slate', value: 'slate' },
    { label: 'Violet', value: 'violet' }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
          <SettingsIcon size={36} className="text-primary-accent" />
          System Configuration
        </h1>
        <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mt-2">Manage your member identity and visual library interface.</p>
      </header>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="glass-panel rounded-[2rem] border-white/5 overflow-hidden">
          <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-accent/10 flex items-center justify-center text-primary-accent">
                <User size={20} />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Member Identity</h2>
            </div>
            {profile?.isPro && (
              <span className="bg-amber-400/10 text-amber-500 text-[9px] font-black px-3 py-1 rounded-lg border border-amber-400/20 uppercase tracking-widest">Lumina Pro Member</span>
            )}
          </div>
          <div className="p-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Public Alias</label>
                <div className="px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-black text-xs uppercase opacity-70">
                  {profile?.name}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Registered Endpoint</label>
                <div className="px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-black text-xs uppercase opacity-70">
                  {profile?.email}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* System & Notification Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="glass-panel rounded-[2rem] border-white/5 p-8 space-y-8">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
              <Bell size={16} className="text-secondary-accent" />
              Sync Alerts
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Push Notifications', key: 'notifications', desc: 'Alert when books are overdue' },
                { label: 'Library Reports', key: 'emailUpdates', desc: 'Weekly catalog updates' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between group">
                  <div>
                    <p className="text-[11px] font-black text-white uppercase tracking-tight">{item.label}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{item.desc}</p>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, [item.key]: !settings[item.key as keyof typeof settings]})}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings[item.key as keyof typeof settings] ? 'bg-primary-accent shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings[item.key as keyof typeof settings] ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] border-white/5 p-8 space-y-8">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
              <Shield size={16} className="text-indigo-400" />
              Privacy Core
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Global Profile', key: 'publicProfile', desc: 'Others can see your loans' },
                { label: 'High Fidelity UI', key: 'darkMode', desc: 'Enable immersive animations' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between group">
                  <div>
                    <p className="text-[11px] font-black text-white uppercase tracking-tight">{item.label}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{item.desc}</p>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, [item.key]: !settings[item.key as keyof typeof settings]})}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings[item.key as keyof typeof settings] ? 'bg-primary-accent shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings[item.key as keyof typeof settings] ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Integration Section */}
        <section className="glass-panel rounded-[2rem] border-white/5 p-10">
          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3 mb-10">
            <Palette size={16} className="text-amber-400" />
            Visual Library Engine
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-6">
            {themeColors.map((t) => (
              <button 
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex flex-col items-center gap-3 group transition-all p-4 rounded-2xl border-2 ${
                  theme === t.value ? 'bg-white/5 border-primary-accent' : 'bg-transparent border-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl shadow-2xl transition-transform group-hover:scale-110 ${
                  t.value === 'indigo' ? 'bg-indigo-600' : 
                  t.value === 'cyan' ? 'bg-cyan-500' : 
                  t.value === 'rose' ? 'bg-rose-500' : 
                  t.value === 'emerald' ? 'bg-emerald-500' :
                  t.value === 'amber' ? 'bg-amber-500' :
                  t.value === 'slate' ? 'bg-slate-500' : 'bg-violet-700'
                } ${theme === t.value ? 'ring-4 ring-primary-accent/20' : ''}`} />
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${theme === t.value ? 'text-white' : 'text-slate-600 group-hover:text-slate-400'}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Action Bar */}
        <div className="pt-10 flex gap-6">
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="flex-1 py-5 bg-primary-accent text-white rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-primary-accent/90 shadow-2xl shadow-primary-accent/30 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Synchronize Preferences
          </button>
          <button 
            className="px-10 py-5 bg-white/5 text-slate-500 rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-white/10 transition-all border border-white/5"
          >
            Reset
          </button>
        </div>
      </div>
      
      <footer className="mt-20 border-t border-white/5 pt-12 text-center space-y-6">
        <div className="flex items-center justify-center gap-8">
           <Smartphone size={20} className="text-slate-700 hover:text-white transition-colors cursor-pointer" />
           <Github size={20} className="text-slate-700 hover:text-white transition-colors cursor-pointer" />
           <Globe size={20} className="text-slate-700 hover:text-white transition-colors cursor-pointer" />
        </div>
        <p className="text-slate-700 font-black uppercase tracking-[0.3em] text-[8px]">
          Luminia Core OS v1.7.2 // Distributed Node // End-to-End Encryption Active
        </p>
      </footer>
    </div>
  );
}
