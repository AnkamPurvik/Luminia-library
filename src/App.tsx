/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile } from './types';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/layout/Navbar';
import OPAC from './pages/OPAC';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BookDetail from './pages/BookDetail';
import LuminaPro from './pages/LuminaPro';
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
    if (!user) return;

    const profileRef = doc(db, 'users', user.uid);
    const profileUnsub = onSnapshot(profileRef, async (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        // Create initial profile if missing
        const newProfile: UserProfile = {
          id: user.uid,
          name: user.displayName || 'Anonymous',
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Initializing Lumina Library...</p>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans antialiased">
        <Toaster position="top-right" />
        <Navbar user={user} isAdmin={isAdmin} isPro={profile?.isPro} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <main>
          <Routes>
            <Route path="/" element={<OPAC searchQuery={searchQuery} onSearchChange={setSearchQuery} />} />
            <Route path="/book/:id" element={<BookDetail />} />
            <Route 
              path="/dashboard" 
              element={user ? <UserDashboard /> : <Navigate to="/" />} 
            />
            <Route 
              path="/admin" 
              element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} 
            />
            <Route path="/pro" element={<LuminaPro />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
