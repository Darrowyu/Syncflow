import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleIcon?: ReactNode;
  titleClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // 弹窗尺寸
  children: ReactNode;
}

const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, titleIcon, titleClassName = '', size = 'lg', children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 dark:bg-black/70 z-[100] flex items-center justify-center p-4" style={{ margin: 0 }}>
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full p-6 animate-scale-in ${sizeClasses[size]}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-bold flex items-center text-slate-800 dark:text-slate-100 ${titleClassName}`}>
            {titleIcon && <span className="mr-2">{titleIcon}</span>}
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>
        <div className="text-slate-700 dark:text-slate-300">{children}</div>
      </div>
    </div>
  );
};
