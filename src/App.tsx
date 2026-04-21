/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile } from './types';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { ChatWidget } from './components/ui/ChatWidget';
import { ThemeProvider } from './context/ThemeContext';
import OPAC from './pages/OPAC';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminBookDetail from './pages/AdminBookDetail';
import BookDetail from './pages/BookDetail';
import LuminaPro from './pages/LuminaPro';
import Login from './pages/Login';
import ActivityTimeline from './pages/ActivityTimeline';
import Settings from './pages/Settings';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Profile Sync
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const profileRef = doc(db, 'users', user.uid);
    const profileUnsub = onSnapshot(profileRef, async (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        // Create initial profile if missing
        const newProfile: UserProfile = {
          id: user.uid,
          name: user.displayName || 'Anonymous Member',
          email: user.email || '',
          role: user.email === 'purvik.ankam@gmail.com' ? 'admin' : 'member',
          membershipStatus: 'active',
          firebaseUid: user.uid,
          createdAt: new Date().toISOString()
        };
        await setDoc(profileRef, newProfile);
        setProfile(newProfile);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Profile sync error:", err);
      setIsLoading(false);
    });

    return () => profileUnsub();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary-accent/20 blur-xl animate-pulse rounded-full"></div>
          <Loader2 className="h-10 w-10 text-primary-accent animate-spin relative z-10" />
        </div>
        <p className="mt-8 text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Loading Library...</p>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <ThemeProvider>
      <Router>
        <div className="h-screen bg-bg-dark text-slate-100 font-sans antialiased selection:bg-primary-accent/30 overflow-hidden flex">
          <Toaster position="top-center" />
          
          {/* Desktop Sidebar — hidden on mobile */}
          <div className="hidden md:block">
            <Sidebar profile={profile} isAdmin={isAdmin} />
          </div>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header profile={profile} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            
            {/* Extra bottom padding on mobile for bottom nav */}
            <main className="flex-1 overflow-y-auto custom-scrollbar relative pb-20 md:pb-0">
              <Routes>
                <Route path="/" element={<OPAC searchQuery={searchQuery} onSearchChange={setSearchQuery} />} />
                <Route path="/book/:id" element={<BookDetail />} />
                <Route path="/login" element={<Login />} />
                <Route 
                  path="/dashboard" 
                  element={user ? <UserDashboard /> : <Navigate to="/" />} 
                />
                <Route 
                  path="/admin" 
                  element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} 
                />
                <Route 
                  path="/admin/book/:id" 
                  element={isAdmin ? <AdminBookDetail /> : <Navigate to="/" />} 
                />
                <Route 
                  path="/admin/timeline" 
                  element={isAdmin ? <ActivityTimeline searchQuery={searchQuery} /> : <Navigate to="/" />} 
                />
                <Route path="/pro" element={<LuminaPro />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <MobileNav profile={profile} isAdmin={isAdmin} />

        {/* Floating Chat Widget — show for logged-in non-admin users */}
        {user && !isAdmin && <ChatWidget />}
      </Router>
    </ThemeProvider>
  );
}
