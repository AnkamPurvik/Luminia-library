import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export interface SettingsState {
  notifications: boolean;
  publicProfile: boolean;
  emailUpdates: boolean;
  refreshInterval: '10s' | '30s' | '1m' | 'manual';
  units: 'metric' | 'imperial';
  analyticsOptOut: boolean;
}

interface SettingsContextType {
  settings: SettingsState;
  updateSettings: (newSettings: Partial<SettingsState>) => Promise<void>;
  notificationsEnabled: boolean;
  showToast: {
    success: (msg: string, opts?: any) => string;
    error: (msg: string, opts?: any) => string;
    info: (msg: string, opts?: any) => string;
    custom: (msg: string, opts?: any) => string;
  };
  unitsSystem: 'metric' | 'imperial';
  analyticsOptOut: boolean;
  refreshTrigger: number;
}

const DEFAULT_SETTINGS: SettingsState = {
  notifications: true,
  publicProfile: true,
  emailUpdates: false,
  refreshInterval: '30s',
  units: 'metric',
  analyticsOptOut: false
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Sync settings with Firestore
  useEffect(() => {
    let unsub = () => {};
    
    const listenToUserDoc = () => {
      const user = auth.currentUser;
      if (!user) {
        setSettings(DEFAULT_SETTINGS);
        return;
      }

      unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.preferences) {
            setSettings({
              ...DEFAULT_SETTINGS,
              ...data.preferences
            });
          }
        }
      }, (err) => {
        console.error('Settings listener failed:', err);
      });
    };

    const authUnsub = auth.onAuthStateChanged(() => {
      unsub();
      listenToUserDoc();
    });

    return () => {
      unsub();
      authUnsub();
    };
  }, []);

  // Set up periodic refresh timer
  useEffect(() => {
    if (settings.refreshInterval === 'manual') return;

    let ms = 30000;
    if (settings.refreshInterval === '10s') ms = 10000;
    if (settings.refreshInterval === '1m') ms = 60000;

    const timer = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, ms);

    return () => clearInterval(timer);
  }, [settings.refreshInterval]);

  const updateSettings = async (newSettings: Partial<SettingsState>) => {
    const user = auth.currentUser;
    if (!user) return;

    const merged = { ...settings, ...newSettings };
    setSettings(merged);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferences: merged
      });
    } catch (err) {
      console.error('Failed to sync settings to Firestore:', err);
      throw err;
    }
  };

  // Custom Toast helper respecting notifications toggle
  const showToast = {
    success: (msg: string, opts?: any) => {
      if (!settings.notifications) return '';
      return toast.success(msg, opts);
    },
    error: (msg: string, opts?: any) => {
      if (!settings.notifications) return '';
      return toast.error(msg, opts);
    },
    info: (msg: string, opts?: any) => {
      if (!settings.notifications) return '';
      return toast(msg, { icon: 'ℹ️', ...opts });
    },
    custom: (msg: string, opts?: any) => {
      if (!settings.notifications) return '';
      return toast(msg, opts);
    }
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      notificationsEnabled: settings.notifications,
      showToast,
      unitsSystem: settings.units,
      analyticsOptOut: settings.analyticsOptOut,
      refreshTrigger
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
