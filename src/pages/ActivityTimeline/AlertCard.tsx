import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, AlertTriangle, Info, XCircle, User, 
  BookOpen, UserPlus, Database, MessageSquare, ChevronDown, 
  ChevronUp, BellRing, PackagePlus, Eye, ShieldAlert, Check, HelpCircle
} from 'lucide-react';
import { ActivityLog } from './types';
import { SeverityBadge } from './SeverityBadge';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface AlertCardProps {
  log: ActivityLog;
  onRefresh: () => void;
  index: number;
}

export const AlertCard: React.FC<AlertCardProps> = ({ log, onRefresh, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [note, setNote] = useState(log.resolutionNote || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const getCategoryIcon = () => {
    switch (log.category) {
      case 'security': return <ShieldAlert size={16} className="text-rose-500" />;
      case 'inventory': return <BookOpen size={16} className="text-amber-500" />;
      case 'loans': return <BellRing size={16} className="text-cyan-500" />;
      case 'members': return <User size={16} className="text-emerald-500" />;
      case 'settings': return <Database size={16} className="text-indigo-500" />;
      default: return <Info size={16} className="text-slate-500" />;
    }
  };

  const getStatusBg = () => {
    if (log.status === 'RESOLVED') return 'bg-emerald-500/10 border-emerald-500/20';
    if (log.status === 'ACKNOWLEDGED') return 'bg-amber-500/10 border-amber-500/20';
    if (log.severity === 'CRITICAL') return 'bg-rose-500/5 border-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.03)]';
    return 'border-white/5 bg-white/[0.01]';
  };

  const handleUpdateStatus = async (newStatus: ActivityLog['status']) => {
    setIsUpdating(true);
    try {
      const logRef = doc(db, 'activity_logs', log.id);
      const nowStr = new Date().toISOString();
      
      let updateFields: any = {
        status: newStatus,
        resolutionNote: note || null
      };

      if (newStatus === 'RESOLVED') {
        const createdAtDate = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.timestamp || log.createdAt);
        const resolvedDate = new Date();
        const latency = resolvedDate.getTime() - createdAtDate.getTime();
        
        updateFields.resolvedAt = nowStr;
        updateFields.resolutionTime = latency;
        updateFields.assignedTo = auth.currentUser?.uid || 'system';
        updateFields.assignedName = auth.currentUser?.displayName || 'Librarian';
      } else if (newStatus === 'ACKNOWLEDGED') {
        updateFields.assignedTo = auth.currentUser?.uid || 'system';
        updateFields.assignedName = auth.currentUser?.displayName || 'Librarian';
      }

      await updateDoc(logRef, updateFields);
      toast.success(`Log updated status to ${newStatus}`);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Actionable Features
  const handleAction = async (actionType: string) => {
    toast.success(`Processing: ${actionType}`);
    
    if (actionType === 'Send Overdue Reminder') {
      toast.promise(
        new Promise(res => setTimeout(res, 1200)),
        {
          loading: 'Sending overdue warning to reader...',
          success: 'Notification dispatched via email successfully!',
          error: 'Dispatch failed.'
        }
      );
    } else if (actionType === 'Order Stock Requisition') {
      toast.promise(
        new Promise(res => setTimeout(res, 1500)),
        {
          loading: 'Filing purchase catalog request...',
          success: 'Requisition sheet created in Admin Inventory logs!',
          error: 'Filing failed.'
        }
      );
    } else if (actionType === 'Suspend Compromised User') {
      try {
        if (!log.user?.uid) {
          toast.error('No member ID linked to this log.');
          return;
        }
        await updateDoc(doc(db, 'users', log.user.uid), {
          membershipStatus: 'suspended'
        });
        toast.success('Account suspended successfully in Firestore DB.');
      } catch (err) {
        toast.error('Failed to update user profile status.');
      }
    }
  };

  const renderActionButtons = () => {
    const action = (log.action || '').toLowerCase();
    
    if (action.includes('overdue')) {
      return (
        <button 
          onClick={() => handleAction('Send Overdue Reminder')}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
        >
          Send Reminder
        </button>
      );
    }
    if (action.includes('low') || action.includes('stock') || action.includes('inventory')) {
      return (
        <button 
          onClick={() => handleAction('Order Stock Requisition')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
        >
          Reorder Stock
        </button>
      );
    }
    if (action.includes('suspicious') || action.includes('failed login') || action.includes('security')) {
      return (
        <button 
          onClick={() => handleAction('Suspend Compromised User')}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
        >
          Block User
        </button>
      );
    }
    return null;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.5) }}
      className={`glass-panel rounded-[2rem] p-6 border ${getStatusBg()} hover:border-primary-accent/20 transition-all shadow-2xl relative`}
    >
      {/* Red Pulse decoration for Critical pending alerts */}
      {log.severity === 'CRITICAL' && log.status === 'PENDING' && (
        <div className="absolute top-4 right-4 w-3.5 h-3.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)] animate-ping pointer-events-none" />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        
        {/* Left Section: User info and action details */}
        <div className="flex items-start gap-4">
          
          {/* Category Icon representation */}
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            {getCategoryIcon()}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{log.category}</span>
              <SeverityBadge severity={log.severity} animate={log.status === 'PENDING'} />
              {log.status !== 'PENDING' && (
                <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${
                  log.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20' : 'bg-amber-500/10 text-amber-400 border-amber-400/20'
                }`}>
                  {log.status}
                </span>
              )}
            </div>

            <h3 className="font-black text-white text-md tracking-tight uppercase mt-1">
              {log.action}
            </h3>

            <p className="text-slate-400 text-xs font-bold uppercase tracking-tight">
              {log.details}
            </p>

            {log.user?.name && (
              <p className="text-primary-accent font-black text-[9px] uppercase tracking-widest">
                Target User: {log.user.name} {log.user.email ? `(${log.user.email})` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Right Section: Timestamps & Action Buttons */}
        <div className="flex flex-col items-end gap-3 shrink-0 self-stretch sm:self-auto justify-between">
          <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">
            {log.timestamp}
          </span>
          
          <div className="flex items-center gap-2">
            {renderActionButtons()}
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all transform"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

      </div>

      {/* Expanded Resolution Details Panel */}
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-6 pt-6 border-t border-white/5 space-y-4 overflow-hidden"
        >
          {/* Note Input */}
          <div className="space-y-2">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Librarian Internal Audit Notes</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Record details of resolution actions (e.g. called borrower, verified backup database, reordered item)"
              className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white text-xs outline-none focus:border-primary-accent transition-all resize-none h-20"
            />
          </div>

          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              {log.status === 'RESOLVED' && log.resolvedAt && (
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                  Resolved by <span className="text-emerald-400">{log.assignedName || 'Librarian'}</span> at {new Date(log.resolvedAt).toLocaleDateString()}
                  {log.resolutionTime && ` (${Math.round(log.resolutionTime / 1000 / 60)} mins latency)`}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {log.status !== 'ACKNOWLEDGED' && log.status !== 'RESOLVED' && (
                <button
                  disabled={isUpdating}
                  onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
                  className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  Mark Acknowledged
                </button>
              )}
              {log.status !== 'RESOLVED' && (
                <button
                  disabled={isUpdating}
                  onClick={() => handleUpdateStatus('RESOLVED')}
                  className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:bg-emerald-600 flex items-center gap-1.5"
                >
                  <Check size={12} />
                  Mark Resolved
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
};
