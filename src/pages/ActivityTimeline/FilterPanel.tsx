import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, Calendar, Shield, Layout, User } from 'lucide-react';
import { FilterState } from './useActivityFilters';
import { SeverityType, CategoryType } from './types';

interface FilterPanelProps {
  isOpen: boolean;
  filters: FilterState;
  onClose: () => void;
  onUpdateFilters: (newFilters: FilterState) => void;
  onResetFilters: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  filters,
  onClose,
  onUpdateFilters,
  onResetFilters
}) => {
  const toggleSeverity = (severity: SeverityType) => {
    const isSelected = filters.severities.includes(severity);
    const newSeverities = isSelected
      ? filters.severities.filter(s => s !== severity)
      : [...filters.severities, severity];
    onUpdateFilters({ ...filters, severities: newSeverities });
  };

  const toggleCategory = (category: CategoryType) => {
    const isSelected = filters.categories.includes(category);
    const newCategories = isSelected
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onUpdateFilters({ ...filters, categories: newCategories });
  };

  const setDateRange = (range: FilterState['dateRange']) => {
    onUpdateFilters({ ...filters, dateRange: range });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass-panel w-full max-w-xl rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary-accent/10 rounded-2xl text-primary-accent">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Advanced Filters</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Refine activity logs view</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all transform hover:rotate-90"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              {/* Severity Options */}
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <Shield size={12} className="text-rose-500" />
                  Severity Levels
                </label>
                <div className="flex flex-wrap gap-3">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as SeverityType[]).map(sev => {
                    const selected = filters.severities.includes(sev);
                    return (
                      <button
                        key={sev}
                        onClick={() => toggleSeverity(sev)}
                        className={`px-5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                          selected
                            ? 'bg-primary-accent/10 border-primary-accent text-white shadow-xl shadow-primary-accent/10'
                            : 'bg-transparent border-white/5 text-slate-500 hover:bg-white/[0.02]'
                        }`}
                      >
                        {sev}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Categories Options */}
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <Layout size={12} className="text-secondary-accent" />
                  Activity Categories
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(['security', 'inventory', 'loans', 'members', 'settings', 'system'] as CategoryType[]).map(cat => {
                    const selected = filters.categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-4 py-3 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all text-center ${
                          selected
                            ? 'bg-secondary-accent/10 border-secondary-accent text-white'
                            : 'bg-transparent border-white/5 text-slate-500 hover:bg-white/[0.02]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Ranges options */}
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <Calendar size={12} className="text-cyan-400" />
                  Date Range
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { label: 'All Time', value: 'all' },
                    { label: 'Today', value: 'today' },
                    { label: '7 Days', value: 'week' },
                    { label: '30 Days', value: 'month' },
                    { label: 'Custom', value: 'custom' }
                  ].map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDateRange(d.value as any)}
                      className={`px-4 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all ${
                        filters.dateRange === d.value
                          ? 'bg-white/10 border-white/20 text-white'
                          : 'bg-transparent border-white/5 text-slate-500 hover:bg-white/[0.02]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Selection Inputs */}
                <AnimatePresence>
                  {filters.dateRange === 'custom' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-2 gap-4 pt-3 overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Start Date</span>
                        <input 
                          type="date"
                          value={filters.startDate}
                          onChange={(e) => onUpdateFilters({ ...filters, startDate: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white font-black text-[9px] uppercase outline-none focus:border-primary-accent"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">End Date</span>
                        <input 
                          type="date"
                          value={filters.endDate}
                          onChange={(e) => onUpdateFilters({ ...filters, endDate: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white font-black text-[9px] uppercase outline-none focus:border-primary-accent"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User search filter */}
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <User size={12} className="text-indigo-400" />
                  Target Member Account
                </label>
                <input 
                  type="text" 
                  value={filters.userSearch}
                  onChange={(e) => onUpdateFilters({ ...filters, userSearch: e.target.value })}
                  placeholder="Filter by member name or email address"
                  className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold text-xs outline-none focus:border-primary-accent transition-all"
                />
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="p-8 border-t border-white/5 bg-white/[0.01] flex gap-4">
              <button 
                onClick={onResetFilters}
                className="px-6 py-4 bg-white/5 border border-white/5 text-[9px] font-black uppercase text-slate-400 hover:text-white rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2 active:scale-95"
              >
                <RefreshCw size={12} />
                Reset Filters
              </button>
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-primary-accent text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] hover:bg-primary-accent/90 shadow-xl shadow-primary-accent/15 transition-all text-center active:scale-95"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
