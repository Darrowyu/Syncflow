import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; type: ToastType; message: string }

const icons = { success: CheckCircle, error: XCircle, warning: AlertCircle, info: Info };
const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

let toastId = 0;
let addToastFn: ((type: ToastType, message: string) => void) | null = null;

export const toast = {
  success: (msg: string) => addToastFn?.('success', msg),
  error: (msg: string) => addToastFn?.('error', msg),
  warning: (msg: string) => addToastFn?.('warning', msg),
  info: (msg: string) => addToastFn?.('info', msg),
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { addToastFn = addToast; return () => { addToastFn = null; }; }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(({ id, type, message }) => {
        const Icon = icons[type];
        return (
          <div key={id} className={`flex items-center p-3 pr-10 rounded-lg border shadow-lg animate-fade-in relative ${styles[type]}`}>
            <Icon size={18} className="mr-2 flex-shrink-0" />
            <span className="text-sm">{message}</span>
            <button onClick={() => removeToast(id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
