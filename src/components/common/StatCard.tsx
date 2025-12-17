import React, { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  iconBgClass: string;
  label: string;
  value: string | number;
  suffix?: string;
  valueClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, iconBgClass, label, value, suffix, valueClass = 'text-slate-800 dark:text-slate-100' }) => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center space-x-4">
    <div className={`p-3 rounded-lg ${iconBgClass}`}>{icon}</div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <h3 className={`text-2xl font-bold ${valueClass}`}>
        {value}{suffix && <span className="text-sm text-slate-400 dark:text-slate-500"> {suffix}</span>}
      </h3>
    </div>
  </div>
);
