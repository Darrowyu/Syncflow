import React, { memo } from 'react';
import { Package, Truck, Calendar, Download, Upload, Bot } from 'lucide-react';
import { useLanguage } from '../../i18n';

interface OrderFiltersProps {
  activeTab: 'all' | 'ready' | 'shipped';
  viewMode: 'table' | 'calendar';
  allCount: number;
  readyCount: number;
  shippedCount: number;
  onTabChange: (tab: 'all' | 'ready' | 'shipped') => void;
  onViewModeChange: (mode: 'table' | 'calendar') => void;
  onExport: () => void;
  onImport: () => void;
  onAiImport: () => void;
}

const OrderFilters: React.FC<OrderFiltersProps> = memo(({ activeTab, viewMode, allCount, readyCount, shippedCount, onTabChange, onViewModeChange, onExport, onImport, onAiImport }) => {
  const { t } = useLanguage();

  return (
    <div className="flex justify-end items-center flex-wrap gap-2">
      <div className="flex flex-wrap gap-2">
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
          <button onClick={() => onViewModeChange('table')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('view_table')}</button>
          <button onClick={() => onViewModeChange('calendar')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}><Calendar size={14} className="mr-1" />{t('view_calendar')}</button>
        </div>
        {viewMode === 'table' && ( // 日历模式下隐藏状态筛选
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
            <button onClick={() => onTabChange('all')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}><Package size={14} className="mr-1" />{t('tab_pending')} <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-600 px-1.5 rounded">{allCount}</span></button>
            <button onClick={() => onTabChange('ready')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${activeTab === 'ready' ? 'bg-white dark:bg-slate-700 shadow text-green-600' : 'text-slate-600 dark:text-slate-400'}`}><Truck size={14} className="mr-1" />{t('tab_ready')} <span className="ml-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 rounded">{readyCount}</span></button>
            <button onClick={() => onTabChange('shipped')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${activeTab === 'shipped' ? 'bg-white dark:bg-slate-700 shadow text-slate-600 dark:text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('tab_shipped')} <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-600 px-1.5 rounded">{shippedCount}</span></button>
          </div>
        )}
        <button onClick={onExport} className="flex items-center px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition" title={t('btn_export')}><Download size={16} className="mr-1" />{t('btn_export')}</button>
        <button onClick={onImport} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"><Upload size={18} className="mr-2" />{t('btn_import')}</button>
        <button onClick={onAiImport} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"><Bot size={18} className="mr-2" />{t('btn_import_ai')}</button>
      </div>
    </div>
  );
});

OrderFilters.displayName = 'OrderFilters';

export default OrderFilters;
