import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  type?: 'default' | 'danger' | 'warning' | 'success';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  type = 'default', 
  confirmLabel, 
  cancelLabel = 'Cancel', 
  onConfirm 
}: ModalProps) {
  
  const getColors = () => {
    switch (type) {
      case 'danger': return { icon: <AlertTriangle className="text-rose-500" />, bg: 'bg-rose-500/5', button: 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-500/50 shadow-rose-500/20' };
      case 'warning': return { icon: <AlertCircle className="text-amber-500" />, bg: 'bg-amber-500/5', button: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/50 shadow-amber-500/20' };
      case 'success': return { icon: <CheckCircle2 className="text-emerald-500" />, bg: 'bg-emerald-500/5', button: 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500/50 shadow-emerald-500/20' };
      default: return { icon: <AlertCircle className="text-primary-accent" />, bg: 'bg-primary-accent/5', button: 'bg-primary-accent hover:bg-primary-accent/90 focus:ring-primary-accent/50 shadow-primary-accent/20' };
    }
  };

  const colors = getColors();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg-dark/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/5"
          >
            <div className={`p-8 flex items-start gap-5 ${colors.bg}`}>
              <div className="mt-1 p-3 bg-white/5 rounded-2xl border border-white/5">
                {colors.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white leading-tight uppercase tracking-tight">
                  {title}
                </h3>
                <div className="mt-3 text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  {children}
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 bg-white/5 border-t border-white/5 flex items-center justify-end gap-4">
              <button
                onClick={onClose}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
              >
                {cancelLabel}
              </button>
              {onConfirm && (
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 ${colors.button}`}
                >
                  {confirmLabel || 'Confirm'}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
