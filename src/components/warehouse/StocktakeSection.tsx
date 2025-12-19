import React, { useState, useMemo, useCallback, memo } from 'react';
import { InventoryItem, WarehouseType, PACKAGE_SPECS } from '../../types';
import { useLanguage } from '../../i18n';
import { ClipboardCheck, Filter, Save, Calendar, Download } from 'lucide-react';
import { toast } from '../common';
import { fetchInventoryAuditLogs } from '../../services/api';

const formatLocalTime = (utcStr: string): string => { // UTC转本地时间
  if (!utcStr) return '-';
  const date = new Date(utcStr.includes('T') ? utcStr : utcStr.replace(' ', 'T') + 'Z');
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

interface StocktakeChange { styleNo: string; warehouseType: string; packageSpec: string; lineId?: number; lineName?: string; origA: number; origB: number; newA: number; newB: number; }
interface StocktakeRecord { id: number; styleNo: string; warehouseType: string; packageSpec: string; lineId?: number; lineName?: string; beforeGradeA: number; beforeGradeB: number; afterGradeA: number; afterGradeB: number; reason: string; createdAt: string; }

interface StocktakeSectionProps {
  inventory: InventoryItem[];
  inventoryLines?: { id: string; name: string }[];
  onUpdateStock?: (styleNo: string, gradeA: number, gradeB: number, warehouseType?: string, packageSpec?: string, reason?: string, lineId?: number, lineName?: string) => Promise<void>;
}

const REASONS = ['stocktake_reason_regular', 'stocktake_reason_loss', 'stocktake_reason_error', 'stocktake_reason_other'] as const;
type ReasonKey = typeof REASONS[number];

const PAGE_SIZE = 20;

const StocktakeSection: React.FC<StocktakeSectionProps> = memo(({ inventory, inventoryLines = [], onUpdateStock }) => {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<'batch' | 'records'>('batch');
  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [filterPackage, setFilterPackage] = useState('all');
  const [filterStyleNo, setFilterStyleNo] = useState('');
  const [filterLine, setFilterLine] = useState('all');
  const [changes, setChanges] = useState<Record<string, { newA: number; newB: number }>>({});
  const [reason, setReason] = useState<ReasonKey>(REASONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<StocktakeRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);

  const filteredInventory = useMemo(() => inventory.filter(i => {
    if (filterWarehouse !== 'all' && i.warehouseType !== filterWarehouse) return false;
    if (filterPackage !== 'all' && i.packageSpec !== filterPackage) return false;
    if (filterStyleNo && !i.styleNo.toLowerCase().includes(filterStyleNo.toLowerCase())) return false;
    if (filterLine !== 'all' && (i.lineId?.toString() || '') !== filterLine) return false;
    return true;
  }), [inventory, filterWarehouse, filterPackage, filterStyleNo, filterLine]);

  const totalPages = Math.ceil(filteredInventory.length / PAGE_SIZE);
  const pagedInventory = useMemo(() => filteredInventory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredInventory, page]);

  React.useEffect(() => { setPage(1); }, [filterWarehouse, filterPackage, filterStyleNo, filterLine]);

  const getKey = useCallback((item: InventoryItem): string => `${item.styleNo}-${item.warehouseType}-${item.packageSpec}-${item.lineId || 'noLine'}`, []);

  const handleChange = useCallback((item: InventoryItem, field: 'newA' | 'newB', value: number): void => {
    const key = getKey(item);
    setChanges(prev => ({ ...prev, [key]: { newA: prev[key]?.newA ?? item.gradeA ?? 0, newB: prev[key]?.newB ?? item.gradeB ?? 0, [field]: value } }));
  }, [getKey]);

  const changedItems = useMemo((): StocktakeChange[] => {
    return filteredInventory.filter(item => {
      const key = getKey(item);
      const c = changes[key];
      if (!c) return false;
      return c.newA !== (item.gradeA ?? 0) || c.newB !== (item.gradeB ?? 0);
    }).map(item => {
      const key = getKey(item);
      const c = changes[key];
      return { styleNo: item.styleNo, warehouseType: item.warehouseType, packageSpec: item.packageSpec, lineId: item.lineId, lineName: item.lineName, origA: item.gradeA ?? 0, origB: item.gradeB ?? 0, newA: c.newA, newB: c.newB };
    });
  }, [filteredInventory, changes, getKey]);

  const handleSubmit = async (): Promise<void> => {
    if (changedItems.length === 0) { toast.warning(t('stocktake_no_change')); return; }
    if (!confirm(`${t('stocktake_confirm')} (${changedItems.length} ${t('stocktake_items')})`)) return;
    setSubmitting(true);
    try {
      for (const item of changedItems) {
        if (onUpdateStock) await onUpdateStock(item.styleNo, item.newA, item.newB, item.warehouseType, item.packageSpec, t(reason), item.lineId, item.lineName);
      }
      toast.success(`${t('stocktake_success')}: ${changedItems.length} ${t('stocktake_items')}`);
      setChanges({});
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  };

  const loadRecords = async (): Promise<void> => {
    setRecordsLoading(true);
    try {
      const res = await fetchInventoryAuditLogs({ action: 'adjust', pageSize: 100 });
      let data = res.data || [];
      if (dateRange.start) data = data.filter(r => r.createdAt >= dateRange.start);
      if (dateRange.end) data = data.filter(r => r.createdAt <= dateRange.end + 'T23:59:59');
      setRecords(data);
    } catch (e) { toast.error((e as Error).message); }
    finally { setRecordsLoading(false); }
  };

  const handleViewChange = (view: 'batch' | 'records'): void => {
    setActiveView(view);
    if (view === 'records') loadRecords(); // 每次切换到记录视图都刷新
  };

  const exportRecords = (): void => {
    if (records.length === 0) return;
    const headers = [t('table_style'), t('filter_line'), t('wh_type'), t('pkg_spec'), `${t('grade_a')}(${t('stocktake_original')})`, `${t('grade_a')}(${t('stocktake_new')})`, `${t('grade_b')}(${t('stocktake_original')})`, `${t('grade_b')}(${t('stocktake_new')})`, t('stocktake_reason'), t('inv_time')];
    const rows = records.map(r => [r.styleNo, r.lineName || '-', r.warehouseType === 'bonded' ? t('wh_bonded') : t('wh_general'), r.packageSpec, r.beforeGradeA, r.afterGradeA, r.beforeGradeB, r.afterGradeB, r.reason, r.createdAt]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `stocktake_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="bg-blue-50 dark:bg-blue-900/30 px-6 py-4 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between">
        <div className="flex items-center">
          <ClipboardCheck className="text-blue-600 dark:text-blue-400 mr-2" size={20} />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">{t('stocktake_title')}</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleViewChange('batch')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${activeView === 'batch' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-blue-200 dark:border-blue-700'}`}>{t('stocktake_batch')}</button>
          <button onClick={() => handleViewChange('records')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${activeView === 'records' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-blue-200 dark:border-blue-700'}`}>{t('stocktake_records')}</button>
        </div>
      </div>

      {activeView === 'batch' ? (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 items-center">
              <Filter size={16} className="text-slate-400" />
              <input type="text" value={filterStyleNo} onChange={e => setFilterStyleNo(e.target.value)} placeholder={t('filter_style_placeholder')} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 w-32" />
              <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900">
                <option value="all">{t('wh_all')}</option>
                <option value={WarehouseType.GENERAL}>{t('wh_general')}</option>
                <option value={WarehouseType.BONDED}>{t('wh_bonded')}</option>
              </select>
              <select value={filterPackage} onChange={e => setFilterPackage(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900">
                <option value="all">{t('pkg_all')}</option>
                {PACKAGE_SPECS.map(ps => <option key={ps} value={ps}>{ps}</option>)}
              </select>
              {inventoryLines.length > 0 && (
                <select value={filterLine} onChange={e => setFilterLine(e.target.value)} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900">
                  <option value="all">{t('filter_line_all')}</option>
                  {inventoryLines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <select value={reason} onChange={e => setReason(e.target.value as ReasonKey)} className="text-sm border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900">
                {REASONS.map(r => <option key={r} value={r}>{t(r)}</option>)}
              </select>
              <button onClick={handleSubmit} disabled={submitting || changedItems.length === 0} className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <Save size={14} />{submitting ? '...' : t('stocktake_submit')} {changedItems.length > 0 && `(${changedItems.length})`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">{t('table_style')}</th>
                  <th className="px-3 py-2 text-left">{t('filter_line')}</th>
                  <th className="px-3 py-2 text-left">{t('wh_type')}</th>
                  <th className="px-3 py-2 text-left">{t('pkg_spec')}</th>
                  <th className="px-3 py-2 text-right">{t('grade_a')} ({t('stocktake_original')})</th>
                  <th className="px-3 py-2 text-right">{t('grade_a')} ({t('stocktake_new')})</th>
                  <th className="px-3 py-2 text-right">{t('grade_b')} ({t('stocktake_original')})</th>
                  <th className="px-3 py-2 text-right">{t('grade_b')} ({t('stocktake_new')})</th>
                  <th className="px-3 py-2 text-right">{t('stocktake_diff')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {pagedInventory.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">{t('inv_no_data')}</td></tr>}
                {pagedInventory.map(item => {
                  const key = getKey(item);
                  const c = changes[key];
                  const origA = item.gradeA ?? 0, origB = item.gradeB ?? 0;
                  const newA = c?.newA ?? origA, newB = c?.newB ?? origB;
                  const diffA = newA - origA, diffB = newB - origB, totalDiff = diffA + diffB;
                  const hasChange = diffA !== 0 || diffB !== 0;
                  return (
                    <tr key={key} className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${hasChange ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <td className="px-3 py-2 font-mono font-medium text-slate-800 dark:text-slate-100">{item.styleNo}</td>
                      <td className="px-3 py-2">{item.lineName ? <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">{item.lineName}</span> : <span className="text-slate-400">-</span>}</td>
                      <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded ${item.warehouseType === WarehouseType.BONDED ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{item.warehouseType === WarehouseType.BONDED ? t('wh_bonded') : t('wh_general')}</span></td>
                      <td className="px-3 py-2 text-xs text-slate-500">{item.packageSpec}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">{origA.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right"><input type="number" step="0.1" value={newA} onChange={e => handleChange(item, 'newA', parseFloat(e.target.value) || 0)} className={`w-20 text-right font-mono border rounded px-2 py-1 text-sm ${hasChange ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900'}`} /></td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">{origB.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right"><input type="number" step="0.1" value={newB} onChange={e => handleChange(item, 'newB', parseFloat(e.target.value) || 0)} className={`w-20 text-right font-mono border rounded px-2 py-1 text-sm ${hasChange ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900'}`} /></td>
                      <td className="px-3 py-2 text-right font-mono">{hasChange ? <span className={totalDiff > 0 ? 'text-emerald-600' : 'text-orange-600'}>{totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(1)}</span> : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-500">{filteredInventory.length} {t('stocktake_items')}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50">{t('inc_prev_page')}</button>
                <span className="text-sm text-slate-600 dark:text-slate-400">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50">{t('inc_next_page')}</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 items-center">
              <Calendar size={16} className="text-slate-400" />
              <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900" />
              <span className="text-slate-400">-</span>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900" />
              <button onClick={loadRecords} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-600">{t('btn_search')}</button>
            </div>
            <button onClick={exportRecords} disabled={records.length === 0} className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">
              <Download size={14} />{t('stocktake_export')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">{t('inv_time')}</th>
                  <th className="px-3 py-2 text-left">{t('table_style')}</th>
                  <th className="px-3 py-2 text-left">{t('filter_line')}</th>
                  <th className="px-3 py-2 text-left">{t('wh_type')}/{t('pkg_spec')}</th>
                  <th className="px-3 py-2 text-right">{t('grade_a')}</th>
                  <th className="px-3 py-2 text-right">{t('grade_b')}</th>
                  <th className="px-3 py-2 text-left">{t('stocktake_reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {recordsLoading && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Loading...</td></tr>}
                {!recordsLoading && records.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">{t('stocktake_no_records')}</td></tr>}
                {records.map(r => {
                  const diffA = r.afterGradeA - r.beforeGradeA, diffB = r.afterGradeB - r.beforeGradeB;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatLocalTime(r.createdAt)}</td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-800 dark:text-slate-100">{r.styleNo}</td>
                      <td className="px-3 py-2">{r.lineName ? <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">{r.lineName}</span> : <span className="text-slate-400">-</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{r.warehouseType === 'bonded' ? t('wh_bonded') : t('wh_general')}/{r.packageSpec}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.beforeGradeA}→{r.afterGradeA} <span className={diffA > 0 ? 'text-emerald-600' : diffA < 0 ? 'text-orange-600' : 'text-slate-400'}>({diffA > 0 ? '+' : ''}{diffA.toFixed(1)})</span></td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{r.beforeGradeB}→{r.afterGradeB} <span className={diffB > 0 ? 'text-emerald-600' : diffB < 0 ? 'text-orange-600' : 'text-slate-400'}>({diffB > 0 ? '+' : ''}{diffB.toFixed(1)})</span></td>
                      <td className="px-3 py-2 text-xs text-slate-500">{r.reason || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

export default StocktakeSection;