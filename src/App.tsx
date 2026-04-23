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
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';

// Lazy load pages for performance
const OPAC = lazy(() => import('./pages/OPAC'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminBookDetail = lazy(() => import('./pages/AdminBookDetail'));
const BookDetail = lazy(() => import('./pages/BookDetail'));
const LuminaPro = lazy(() => import('./pages/LuminaPro'));
const Login = lazy(() => import('./pages/Login'));
const ActivityTimeline = lazy(() => import('./pages/ActivityTimeline'));
const Settings = lazy(() => import('./pages/Settings'));

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
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-40">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary-accent/20 blur-2xl animate-pulse rounded-full"></div>
                    <Loader2 className="h-10 w-10 text-primary-accent animate-spin relative z-10" />
                  </div>
                </div>
              }>
                <Routes>
                  <Route path="/" element={<OPAC searchQuery={searchQuery} onSearchChange={setSearchQuery} user={user} />} />
                  <Route path="/book/:id" element={<BookDetail user={user} profile={profile} />} />
                  <Route path="/login" element={<Login />} />
                  <Route 
                    path="/dashboard" 
                    element={user ? <UserDashboard user={user} profile={profile} /> : <Navigate to="/" />} 
                  />
                  <Route 
                    path="/admin" 
                    element={isAdmin ? <AdminDashboard user={user} profile={profile} /> : <Navigate to="/" />} 
                  />
                  <Route 
                    path="/admin/book/:id" 
                    element={isAdmin ? <AdminBookDetail user={user} profile={profile} /> : <Navigate to="/" />} 
                  />
                  <Route 
                    path="/admin/timeline" 
                    element={isAdmin ? <ActivityTimeline user={user} profile={profile} searchQuery={searchQuery} /> : <Navigate to="/" />} 
                  />
                  <Route path="/pro" element={<LuminaPro user={user} profile={profile} />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
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
