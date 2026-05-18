import { useState, useEffect } from 'react';
import { auth, db, logActivity } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { motion } from 'motion/react';
import { 
  Settings as SettingsIcon, Bell, Shield, Eye, Palette, 
  Smartphone, Github, Globe, User, Save, Loader2, Trash2, Sliders, RefreshCcw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UserProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, setTheme, mode, setMode } = useTheme();
  
  // Local state for settings
  const [settings, setSettings] = useState({
    notifications: true,
    publicProfile: true,
    emailUpdates: false,
    refreshInterval: '30s',
    units: 'metric',
    analyticsOptOut: false
  });

  // Account update states
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile & { preferences?: any };
        setProfile(data);
        if (data.preferences) {
          setSettings(prev => ({ ...prev, ...data.preferences }));
        }
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        preferences: settings,
        themePref: theme,
        modePref: mode
      });
      
      await logActivity({
        type: 'user',
        user: { name: profile?.name || 'User' },
        action: 'Updated system configuration',
        details: 'User interface preferences updated successfully.',
        status: 'SUCCESS'
      });
      
      toast.success('System preferences updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    
    if (!currentPassword) {
      toast.error('Current password is required to update credentials.');
      return;
    }
    
    setIsUpdatingAccount(true);
    const id = toast.loading('Re-authenticating...');
    try {
      const credential = EmailAuthProvider.credential(user.email || '', currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      if (newEmail && newEmail !== user.email) {
        toast.loading('Updating email...', { id });
        await updateEmail(user, newEmail);
        await updateDoc(doc(db, 'users', user.uid), { email: newEmail });
        toast.success('Email updated successfully!', { id });
      }
      
      if (newPassword) {
        toast.loading('Updating password...', { id });
        await updatePassword(user, newPassword);
        toast.success('Password updated successfully!', { id });
      }
      
      setCurrentPassword('');
      setNewPassword('');
      setNewEmail('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Verification or update failed.', { id });
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    if (!window.confirm('WARNING: Deleting your account will permanently purge all loans, reservations, and profile metadata. Proceed with absolute caution.')) {
      return;
    }
    
    const passwordConfirm = window.prompt('Confirm password to delete account:');
    if (!passwordConfirm) return;
    
    setIsSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email || '', passwordConfirm);
      await reauthenticateWithCredential(user, credential);
      
      // Delete user doc from firestore
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Delete auth user
      await deleteUser(user);
      
      toast.success('Your profile has been deleted.');
      auth.signOut();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Deletion failed. Check your password.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = () => {
    localStorage.clear();
    toast.success('Local settings and theme cache purged successfully.');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-primary-accent animate-spin mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Saving Settings...</p>
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
          Settings
        </h1>
        <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mt-2">Manage your profile and display preferences.</p>
      </header>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="glass-panel rounded-[2rem] border-white/5 overflow-hidden">
          <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-accent/10 flex items-center justify-center text-primary-accent">
                <User size={20} />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">User Profile</h2>
            </div>
            {profile?.isPro && (
              <span className="bg-amber-400/10 text-amber-500 text-[9px] font-black px-3 py-1 rounded-lg border border-amber-400/20 uppercase tracking-widest">Lumina Pro Member</span>
            )}
          </div>
          <div className="p-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Full Name</label>
                <div className="px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-black text-xs uppercase opacity-70">
                  {profile?.name}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Email Address</label>
                <div className="px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-black text-xs uppercase opacity-70">
                  {profile?.email}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* System, Notification & General Preferences Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="glass-panel rounded-[2rem] border-white/5 p-8 space-y-8">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
              <Bell size={16} className="text-secondary-accent" />
              Notifications & General
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

              {/* Data Refresh Interval */}
              <div className="pt-4 border-t border-white/5 space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Auto-Refresh Interval</label>
                <select 
                  value={settings.refreshInterval}
                  onChange={(e) => setSettings({ ...settings, refreshInterval: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white font-black text-[10px] uppercase outline-none focus:border-primary-accent"
                >
                  <option value="10s" className="bg-bg-dark">10 Seconds</option>
                  <option value="30s" className="bg-bg-dark">30 Seconds</option>
                  <option value="1m" className="bg-bg-dark">1 Minute</option>
                  <option value="manual" className="bg-bg-dark">Manual Only</option>
                </select>
              </div>

              {/* Units Preference */}
              <div className="pt-2 space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Preferred Metrics System</label>
                <div className="flex gap-4">
                  {['metric', 'imperial'].map((u) => (
                    <button
                      key={u}
                      onClick={() => setSettings({ ...settings, units: u })}
                      className={`flex-1 py-3 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                        settings.units === u ? 'bg-primary-accent/10 border-primary-accent text-white' : 'bg-transparent border-white/5 text-slate-500 hover:bg-white/[0.02]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] border-white/5 p-8 space-y-8">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
              <Shield size={16} className="text-indigo-400" />
              Privacy & Security
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Global Profile', key: 'publicProfile', desc: 'Others can see your loans' },
                { label: 'Opt-Out of Analytics', key: 'analyticsOptOut', desc: 'Do not track usage statistics' }
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
              
              {/* Light Mode Toggle */}
              <div className="flex items-center justify-between group pt-2 border-t border-white/5">
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                    {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Toggle interface theme</p>
                </div>
                <button 
                  onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
                  className={`w-12 h-6 rounded-full transition-all relative ${mode === 'dark' ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${mode === 'dark' ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Clear Cache Button */}
              <div className="pt-4 border-t border-white/5">
                <button 
                  onClick={handleClearCache}
                  className="w-full py-4 bg-white/5 border border-white/5 text-[9px] font-black uppercase text-rose-500 tracking-widest rounded-xl hover:bg-rose-500/10 hover:border-rose-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={12} />
                  Purge Application Cache
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Account Credentials / Re-auth Form */}
        <section className="glass-panel rounded-[2rem] border-white/5 p-10 space-y-8">
          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
            <Sliders size={16} className="text-emerald-400" />
            Security & Authentication Update
          </h3>
          <form onSubmit={handleAccountUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">New Email Address</label>
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold text-xs outline-none focus:border-primary-accent transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">New Secure Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold text-xs outline-none focus:border-primary-accent transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-amber-500 tracking-widest">Current Password (Required)</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Verify account password"
                  className="w-full px-5 py-4 bg-white/5 border border-amber-500/20 rounded-2xl text-white font-bold text-xs outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={isUpdatingAccount}
              className="py-4 px-8 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 shadow-xl shadow-emerald-500/10"
            >
              {isUpdatingAccount ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Update Account Security
            </button>
          </form>
        </section>

        {/* Integration Section */}
        <section className="glass-panel rounded-[2rem] border-white/5 p-10">
          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3 mb-10">
            <Palette size={16} className="text-amber-400" />
            Theme & Appearance
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

        {/* Danger Zone */}
        <section className="glass-panel rounded-[2rem] border-rose-500/10 bg-rose-500/[0.02] p-10 space-y-6">
          <div>
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-3">
              <Trash2 size={16} />
              Danger Zone
            </h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Actions in this zone are destructive and cannot be undone.</p>
          </div>
          <button 
            onClick={handleDeleteAccount}
            className="py-4 px-8 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] hover:bg-rose-700 transition-all active:scale-95 shadow-xl shadow-rose-600/10 flex items-center gap-2"
          >
            <Trash2 size={12} />
            Permanently Purge & Delete Account
          </button>
        </section>

        {/* Action Bar */}
        <div className="pt-10 flex gap-6">
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="flex-1 py-5 bg-primary-accent text-white rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-primary-accent/90 shadow-2xl shadow-primary-accent/30 transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save System Preferences
          </button>
          <button 
            onClick={() => setSettings({
              notifications: true,
              publicProfile: true,
              emailUpdates: false,
              refreshInterval: '30s',
              units: 'metric',
              analyticsOptOut: false
            })}
            className="px-10 py-5 bg-white/5 text-slate-500 rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-white/10 transition-all border border-white/5"
          >
            Reset Defaults
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
          Luminia Library v1.7.2 // Secure Connection Active
        </p>
      </footer>
    </div>
  );
}
