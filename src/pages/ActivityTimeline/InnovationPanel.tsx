import React from 'react';
import { Brain, Calendar, TrendingUp, AlertTriangle, UserCheck } from 'lucide-react';

export const InnovationPanel: React.FC = () => {
  return (
    <div className="space-y-8 lg:sticky lg:top-8">
      
      {/* 🤖 1. Predictive Alerts Widget */}
      <div className="glass-panel rounded-[2rem] border-white/5 p-6 bg-indigo-500/[0.01]">
        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
          <Brain size={16} className="text-indigo-400 animate-pulse" />
          Predictive Overdue Alerts
        </h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-white font-black uppercase tracking-tight">The Odyssey</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[8px] font-black uppercase tracking-widest">
                87% Risk
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              Borrower: Purvik (Frequently returns late). Predicted arrival delay of 4 days.
            </p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-white font-black uppercase tracking-tight">Jane Eyre</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest">
                64% Risk
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              Borrower: John Doe (Currently has 2 active holds). High load risk flagged.
            </p>
          </div>
        </div>
      </div>

      {/* 📊 2. Peak Hour Activity Heatmap */}
      <div className="glass-panel rounded-[2rem] border-white/5 p-6 bg-cyan-500/[0.01]">
        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
          <Calendar size={16} className="text-cyan-400" />
          Peak Desk Hours (Last 7d)
        </h3>
        
        {/* Heatmap Grid representing hours vs days */}
        <div className="space-y-4">
          <div className="grid grid-cols-6 gap-2">
            {['9am', '11am', '1pm', '3pm', '5pm', '7pm'].map((h, i) => (
              <div key={h} className="text-center">
                <span className="text-[7px] text-slate-600 font-black uppercase tracking-widest">{h}</span>
                <div className={`mt-1.5 h-8 rounded-lg transition-all ${
                  i === 2 || i === 3 ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' :
                  i === 1 || i === 4 ? 'bg-cyan-600/50' : 'bg-white/5'
                }`} />
              </div>
            ))}
          </div>
          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-right">
            🔥 Highest checkout density around 1pm - 3pm
          </p>
        </div>
      </div>

      {/* 🎯 3. Member Risk Score Card */}
      <div className="glass-panel rounded-[2rem] border-white/5 p-6 bg-emerald-500/[0.01]">
        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
          <UserCheck size={16} className="text-emerald-400" />
          Member Overdue Risk Tracker
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[9px] uppercase font-black text-slate-500">
              <span>John Miller</span>
              <span className="text-rose-500">92 Score</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: '92%' }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[9px] uppercase font-black text-slate-500">
              <span>Sarah Connor</span>
              <span className="text-amber-500">54 Score</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '54%' }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[9px] uppercase font-black text-slate-500">
              <span>Bruce Wayne</span>
              <span className="text-emerald-500">12 Score</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '12%' }} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
