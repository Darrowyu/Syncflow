import React, { memo } from 'react';
import { InventoryItem } from '../../types';
import { Plus, Minus, Edit2, History, Package } from 'lucide-react';
import { useLanguage } from '../../i18n';

interface InventoryTableProps {
  inventory: InventoryItem[];
  onStockIn?: (styleNo: string) => void;
  onStockOut?: (styleNo: string) => void;
  onEdit?: (styleNo: string) => void;
  onHistory?: (styleNo: string) => void;
}

const InventoryTable: React.FC<InventoryTableProps> = memo(({ inventory, onStockIn, onStockOut, onEdit, onHistory }) => {
  const { t } = useLanguage();



  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="bg-emerald-50 dark:bg-emerald-900/30 px-6 py-4 border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between">
        <div className="flex items-center">
          <Package className="text-emerald-600 dark:text-emerald-400 mr-2" size={20}/>
          <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">{t('inv_title')}</h3>
          <span className="ml-2 bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs px-2 py-0.5 rounded-full font-bold">{inventory.length}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
            <tr>
              <th className="px-4 py-3 text-left">{t('table_style')}</th>
              <th className="px-4 py-3 text-right">{t('grade_a')}</th>
              <th className="px-4 py-3 text-right">{t('grade_b')}</th>
              <th className="px-4 py-3 text-right">{t('inv_current_stock')}</th>
              <th className="px-4 py-3 text-center w-40">{t('table_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {inventory.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">{t('inv_no_data')}</td></tr>}
            {inventory.map(item => (
              <tr key={item.styleNo} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-slate-100">{item.styleNo}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{(item.gradeA || 0).toFixed(1)}t</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{(item.gradeB || 0).toFixed(1)}t</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">{item.currentStock.toFixed(1)}t</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center space-x-1">
                    {onStockIn && <button onClick={() => onStockIn(item.styleNo)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 rounded" title={t('inv_in')}><Plus size={14} /></button>}
                    {onStockOut && <button onClick={() => onStockOut(item.styleNo)} className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/50 rounded" title={t('inv_out')}><Minus size={14} /></button>}
                    {onEdit && <button onClick={() => onEdit(item.styleNo)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title={t('inv_stocktake')}><Edit2 size={14} /></button>}
                    {onHistory && <button onClick={() => onHistory(item.styleNo)} className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded" title={t('inv_history')}><History size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

InventoryTable.displayName = 'InventoryTable';

export default InventoryTable;
