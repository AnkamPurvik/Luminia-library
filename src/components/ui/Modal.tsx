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
      case 'danger': return { icon: <AlertTriangle className="text-rose-600" />, bg: 'bg-rose-50', button: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' };
      case 'warning': return { icon: <AlertCircle className="text-amber-600" />, bg: 'bg-amber-50', button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500' };
      case 'success': return { icon: <CheckCircle2 className="text-emerald-600" />, bg: 'bg-emerald-50', button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' };
      default: return { icon: <AlertCircle className="text-indigo-600" />, bg: 'bg-indigo-50', button: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' };
    }
  };

  const colors = getColors();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className={`p-6 flex items-start gap-4 ${colors.bg}`}>
              <div className="mt-1 p-2 bg-white/50 rounded-xl">
                {colors.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 leading-tight">
                  {title}
                </h3>
                <div className="mt-2 text-slate-600 leading-relaxed">
                  {children}
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                {cancelLabel}
              </button>
              {onConfirm && (
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${colors.button}`}
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
