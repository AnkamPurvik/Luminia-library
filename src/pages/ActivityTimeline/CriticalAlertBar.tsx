import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ShieldAlert, Info, Bell, ToggleLeft, ToggleRight } from 'lucide-react';
import { SeverityType } from './types';

interface CriticalAlertBarProps {
  counts: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  showLow: boolean;
  onToggleLow: () => void;
  onScrollToSeverity: (severity: SeverityType) => void;
}

export const CriticalAlertBar: React.FC<CriticalAlertBarProps> = ({
  counts,
  showLow,
  onToggleLow,
  onScrollToSeverity
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel border-white/5 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden"
    >
      {/* Decorative pulse glow */}
      {counts.CRITICAL > 0 && (
        <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />
      )}

      <div className="flex flex-wrap items-center gap-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${counts.CRITICAL > 0 ? 'bg-rose-500/10 text-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-white/5 text-slate-400'}`}>
            <ShieldAlert size={20} className={counts.CRITICAL > 0 ? 'animate-bounce' : ''} />
          </div>
          <div>
            <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest">System Monitor</h4>
            <p className="text-[11px] text-white font-bold uppercase tracking-tight">Real-time Safety Feed</p>
          </div>
        </div>

        <div className="h-8 w-[1px] bg-white/5 hidden md:block" />

        {/* Color Coded Stats Badges */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => counts.CRITICAL > 0 && onScrollToSeverity('CRITICAL')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              counts.CRITICAL > 0 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(244,63,94,0.1)]' 
                : 'bg-white/5 border-transparent text-slate-500 cursor-default'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            🚨 CRITICAL ({counts.CRITICAL})
          </button>

          <button 
            onClick={() => counts.HIGH > 0 && onScrollToSeverity('HIGH')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              counts.HIGH > 0 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:scale-105 active:scale-95' 
                : 'bg-white/5 border-transparent text-slate-500 cursor-default'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            ⚠️ HIGH ({counts.HIGH})
          </button>

          <button 
            onClick={() => counts.MEDIUM > 0 && onScrollToSeverity('MEDIUM')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              counts.MEDIUM > 0 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:scale-105 active:scale-95' 
                : 'bg-white/5 border-transparent text-slate-500 cursor-default'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            ℹ️ MEDIUM ({counts.MEDIUM})
          </button>
        </div>
      </div>

      {/* Info density toggle */}
      <div className="flex items-center gap-3 relative z-10 border-t md:border-t-0 border-white/5 pt-4 md:pt-0 w-full md:w-auto justify-end">
        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Show routine logs</span>
        <button 
          onClick={onToggleLow}
          className="text-slate-400 hover:text-white transition-all transform active:scale-90"
        >
          {showLow ? (
            <ToggleRight size={32} className="text-primary-accent" />
          ) : (
            <ToggleLeft size={32} className="opacity-40" />
          )}
        </button>
      </div>
    </motion.div>
  );
};
