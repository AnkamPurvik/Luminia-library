import React from 'react';
import { SeverityType } from './types';

interface SeverityBadgeProps {
  severity: SeverityType;
  animate?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, animate = false }) => {
  const getStyles = () => {
    switch (severity) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
          dot: 'bg-rose-500',
          shadow: animate ? 'shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse' : ''
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
          dot: 'bg-amber-500',
          shadow: ''
        };
      case 'MEDIUM':
        return {
          bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          dot: 'bg-cyan-400',
          shadow: ''
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          dot: 'bg-slate-400',
          shadow: ''
        };
    }
  };

  const styles = getStyles();

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles.bg} ${styles.shadow}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {severity}
    </span>
  );
};
