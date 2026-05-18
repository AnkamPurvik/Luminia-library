import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Filter, ShieldAlert, SlidersHorizontal, Loader2, 
  HelpCircle, ChevronRight, Volume2, VolumeX, CheckCircle, Database
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, limit, startAfter, getDocs 
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { ActivityLog, SeverityType } from './types';
import { useCriticalAlerts } from './useCriticalAlerts';
import { useActivityFilters, INITIAL_FILTERS } from './useActivityFilters';
import { CriticalAlertBar } from './CriticalAlertBar';
import { FilterPanel } from './FilterPanel';
import { ExportButton } from './ExportButton';
import { AlertCard } from './AlertCard';
import PredictiveOverdueAlerts from './PredictiveOverdueAlerts';
import toast from 'react-hot-toast';

import { User as FirebaseUser } from 'firebase/auth';
import { useNotifications } from '../../context/NotificationContext';

export default function ActivityTimeline({ 
  user, 
  profile, 
  searchQuery = '' 
}: { 
  user: FirebaseUser | null, 
  profile: any, 
  searchQuery?: string 
}) {
  const { sendNotification, showToast } = useNotifications();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Real-time listener limits
  const [queryLimit, setQueryLimit] = useState(50);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Keep track of read/unread count to prevent spamming notifications on first load
  const isFirstLoad = useRef(true);

  // Sound generator
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio play was restricted by user interaction guidelines.');
    }
  };

  // Custom in-app notification trigger
  const triggerPushNotification = (action: string, details: string) => {
    sendNotification({
      userId: auth.currentUser?.uid || '',
      title: `🚨 CRITICAL: ${action}`,
      message: details,
      type: 'critical',
      category: 'system',
      priority: 'high',
      metadata: {
        actionUrl: '/admin/timeline',
        actionLabel: 'Audit Logs'
      }
    });

    // Also display in-app transient toast
    showToast(`🚨 CRITICAL: ${action} - ${details}`, 'error');
    playAlertSound();
  };

  // Set up real-time listener for logs feed
  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('createdAt', 'desc'),
      limit(queryLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Find if a new critical log was injected
      if (!isFirstLoad.current && logsData.length > logs.length) {
        const latest = logsData[0] as any;
        // Score severity dynamically
        const details = (latest.details || '').toLowerCase();
        const action = (latest.action || '').toLowerCase();
        const status = (latest.status || '').toUpperCase();
        
        const isCritical = status === 'ERROR' || action.includes('failed') || action.includes('unauthorized') || action.includes('suspicious') || details.includes('critical');
        
        if (isCritical) {
          triggerPushNotification(latest.action || 'Critical Security Trigger', latest.details || 'A critical log requires audit attention.');
        }
      }

      setLogs(logsData);
      setLastVisibleDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      
      if (snapshot.docs.length < queryLimit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
      
      setIsLoading(false);
      isFirstLoad.current = false;
    }, (err) => {
      console.error(err);
      toast.error('Failed to sync activity logs.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [queryLimit]);

  // Load more logs pagination
  const handleLoadMore = async () => {
    if (!lastVisibleDoc || isFetchingMore) return;
    setIsFetchingMore(true);

    try {
      const q = query(
        collection(db, 'activity_logs'),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisibleDoc),
        limit(50)
      );

      const snap = await getDocs(q);
      const newLogsData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setLogs(prev => [...prev, ...newLogsData]);
      setLastVisibleDoc(snap.docs[snap.docs.length - 1] || null);
      
      if (snap.docs.length < 50) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to retrieve pagination logs.');
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Critical scoring processing
  const { processedLogs, counts } = useCriticalAlerts(logs);

  // Filters hook
  const { 
    filters, 
    setFilters, 
    filteredLogs, 
    resetFilters 
  } = useActivityFilters(processedLogs);

  // Wire search input from header/parent query
  useEffect(() => {
    if (searchQuery) {
      setFilters(prev => ({ ...prev, userSearch: searchQuery }));
    } else {
      setFilters(prev => ({ ...prev, userSearch: '' }));
    }
  }, [searchQuery, setFilters]);

  // Smooth scroll helper
  const handleScrollToSeverity = (severity: SeverityType) => {
    const element = document.querySelector(`[data-severity="${severity}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Spark visual border highlight effect
      element.classList.add('ring-4', 'ring-primary-accent/40');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-primary-accent/40');
      }, 2000);
    } else {
      toast.success(`No unresolved ${severity} logs are visible on screen!`);
    }
  };

  return (
    <div className="space-y-10 min-h-screen">
      
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Activity Monitor</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">
            Audit Trails, System Diagnostics, and Live Alerts
          </p>
        </div>

        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          {/* Audio toggle button */}
          <button 
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              toast.success(soundEnabled ? 'Alert audio synthesizer muted.' : 'Alert audio synthesizer active.');
            }}
            className="p-4 bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-[1.5rem] hover:bg-white/10 transition-all flex items-center justify-center"
            title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-rose-500" />}
          </button>

          <ExportButton logs={filteredLogs} />
          
          <button 
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-primary-accent text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-primary-accent/90 shadow-2xl shadow-primary-accent/20 transition-all active:scale-95 shrink-0"
          >
            <SlidersHorizontal size={14} />
            Filters Panel
          </button>
        </div>
      </div>

      {/* Critical counter and alerts summary bar */}
      <CriticalAlertBar 
        counts={counts}
        showLow={filters.showLow}
        onToggleLow={() => setFilters(prev => ({ ...prev, showLow: !prev.showLow }))}
        onScrollToSeverity={handleScrollToSeverity}
      />

      {/* Main timeline page container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Side: Dynamic Activity Timeline Feed (2/3 columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Header count indicators */}
          <div className="flex justify-between items-center px-4">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
              Displaying {filteredLogs.length} audit entry logs
            </span>
            {filteredLogs.length === 0 && (
              <span className="text-[9px] text-rose-500 font-black uppercase tracking-widest">
                No match filters found
              </span>
            )}
          </div>

          <div className="space-y-6 relative border-l border-white/5 pl-6 ml-6">
            
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 size={32} className="animate-spin text-primary-accent" />
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Syncing active datastream...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="glass-panel border-white/5 rounded-[2rem] p-10 text-center space-y-4">
                  <Database size={24} className="text-slate-600 mx-auto" />
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                    No logs match your current filter settings. Try resetting parameters.
                  </p>
                  <button 
                    onClick={resetFilters}
                    className="px-6 py-2.5 bg-white/5 border border-white/15 text-[9px] font-black uppercase text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    Reset Active Filters
                  </button>
                </div>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div key={log.id} data-severity={log.severity}>
                    <AlertCard 
                      log={log}
                      index={idx}
                      onRefresh={() => {}}
                    />
                  </div>
                ))
              )}
            </AnimatePresence>

          </div>

          {/* Load More/Pagination element */}
          {hasMore && !isLoading && (
            <div className="pt-6 text-center">
              <button 
                onClick={handleLoadMore}
                disabled={isFetchingMore}
                className="px-10 py-5 bg-white/5 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 inline-flex items-center gap-3"
              >
                {isFetchingMore ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Fetching database records...
                  </>
                ) : (
                  'Load More Activities'
                )}
              </button>
            </div>
          )}

        </div>

        {/* Right Side: Innovative Predictive Panel widgets (1/3 column) */}
        <div className="lg:col-span-1">
          <PredictiveOverdueAlerts />
        </div>

      </div>

      {/* Advanced Filter Modal Dropdown Overlay */}
      <FilterPanel 
        isOpen={isFilterOpen}
        filters={filters}
        onClose={() => setIsFilterOpen(false)}
        onUpdateFilters={setFilters}
        onResetFilters={resetFilters}
      />

    </div>
  );
}
