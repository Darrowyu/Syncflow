import React from 'react';
import { ProductLine, LineStatus } from '../../types';
import { Trash2, History, GitBranch } from 'lucide-react';

interface LineCardProps {
  line: ProductLine;
  onEdit: (line: ProductLine) => void;
  onDelete: (id: number) => void;
  onShowHistory: (id: number) => void;
}

const LineCard: React.FC<LineCardProps> = ({ line, onEdit, onDelete, onShowHistory }) => {
  const hasSubLines = line.subLines && line.subLines.length > 0;
  const totalCap = hasSubLines ? line.subLines!.reduce((s, sub) => s + sub.dailyCapacity, 0) : line.dailyCapacity;
  const totalExport = hasSubLines ? line.subLines!.reduce((s, sub) => s + (sub.exportCapacity || 0), 0) : (line.exportCapacity || 0);
  const displayStyle = hasSubLines ? line.subLines!.map(s => s.currentStyle).filter(s => s !== '-').join('/') || '-' : line.currentStyle;
  const statusColor = line.status === LineStatus.RUNNING ? 'bg-green-500' : line.status === LineStatus.MAINTENANCE ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-600';

  return (
    <div onClick={() => onEdit(line)} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition group">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-slate-800 dark:text-slate-100">{line.name}</span>
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
          {hasSubLines && <GitBranch size={12} className="text-slate-400 dark:text-slate-500" />}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">款号</span><span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[80px]" title={displayStyle}>{displayStyle}</span></div>
        <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">产能</span><span className="font-mono text-slate-700 dark:text-slate-300">{totalCap}t</span></div>
        <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">外贸</span><span className="font-mono text-green-600 dark:text-green-400 font-medium">{totalExport}t</span></div>
      </div>
      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
        <button onClick={(e) => { e.stopPropagation(); onShowHistory(line.id); }} className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"><History size={12} className="inline mr-1" />历史</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(line.id); }} className="text-xs text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

export default LineCard;
