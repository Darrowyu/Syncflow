import React, { useState, useRef, useEffect, useCallback } from 'react';
import { InventoryItem, ProductLine, LineStatus, WarehouseType, PACKAGE_SPECS } from '../../types';
import { useLanguage } from '../../i18n';
import { Package, Plus, Minus, History, Lock, Unlock, Settings, Filter, Factory, MoreHorizontal } from 'lucide-react';
import { useIsMobile } from '../../hooks';
import InventoryAlerts from './InventoryAlerts';

interface ActionMenuProps {
  item: InventoryItem;
  onShowHistory: (styleNo: string, warehouseType?: string, packageSpec?: string) => void;
  onOpenLockModal: (item: InventoryItem) => void;
  onOpenSafetyModal: (item: InventoryItem) => void;
  onGetTransactions?: boolean;
  onLockStock?: boolean;
  onUnlockStock?: boolean;
  onSetSafetyStock?: boolean;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ item, onShowHistory, onOpenLockModal, onOpenSafetyModal, onGetTransactions, onLockStock, onUnlockStock, onSetSafetyStock }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  const menuItems = [
    onGetTransactions && { icon: <History size={14} />, label: t('inv_history'), onClick: () => onShowHistory(item.styleNo, item.warehouseType, item.packageSpec) },
    (onLockStock || onUnlockStock) && { icon: (item.lockedForToday || 0) > 0 ? <Lock size={14} /> : <Unlock size={14} />, label: t('inv_lock_unlock'), onClick: () => onOpenLockModal(item) },
    onSetSafetyStock && { icon: <Settings size={14} />, label: t('inv_safety_stock'), onClick: () => onOpenSafetyModal(item) },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; onClick: () => void }[];

  if (menuItems.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title={t('more_items')}><MoreHorizontal size={14} /></button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-32 py-1">
          {menuItems.map((m, i) => (
            <button key={i} onClick={() => { m.onClick(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              {m.icon}<span>{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface PendingItem { lineId: number; lineName: string; subLineId?: string; subLineName?: string; styleNo: string; quantity: number; }

interface InventorySectionProps {
  inventory: InventoryItem[];
  lines: ProductLine[];
  filteredInventory: InventoryItem[];
  filterWarehouse: string;
  filterPackage: string;
  filterStyleNo: string;
  exporting: boolean;
  onFilterWarehouseChange: (v: string) => void;
  onFilterPackageChange: (v: string) => void;
  onFilterStyleNoChange: (v: string) => void;
  onOpenStockModal: (type: 'in' | 'out' | 'edit' | 'production', styleNo: string, warehouseType?: string, packageSpec?: string) => void;
  onShowHistory: (styleNo: string, warehouseType?: string, packageSpec?: string) => void;
  onOpenLockModal: (item: InventoryItem) => void;
  onOpenSafetyModal: (item: InventoryItem) => void;
  onOpenAuditLogs: () => void;
  onExport: () => void;
  onOpenProductionIn: (item: PendingItem) => void;
  onSetSafetyStock?: (styleNo: string, safetyStock: number, warehouseType?: string, packageSpec?: string) => Promise<void>;
  onStockIn?: boolean;
  onStockOut?: boolean;
  onUpdateStock?: boolean;
  onGetTransactions?: boolean;
  onLockStock?: boolean;
  onUnlockStock?: boolean;
}

const PAGE_SIZE = 20;

const InventorySection: React.FC<InventorySectionProps> = ({
  inventory, lines, filteredInventory, filterWarehouse, filterPackage, filterStyleNo, exporting,
  onFilterWarehouseChange, onFilterPackageChange, onFilterStyleNoChange,
  onOpenStockModal, onShowHistory, onOpenLockModal, onOpenSafetyModal, onOpenAuditLogs, onExport, onOpenProductionIn, onSetSafetyStock,
  onStockIn, onStockOut, onUpdateStock, onGetTransactions, onLockStock, onUnlockStock
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(filteredInventory.length / PAGE_SIZE);
  const pagedInventory = React.useMemo(() => filteredInventory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredInventory, page]);

  React.useEffect(() => { setPage(1); }, [filterWarehouse, filterPackage, filterStyleNo]);

  const pendingStockIn = React.useMemo(() => { // 计算待入库队列
    const pending: PendingItem[] = [];
    lines.filter(l => l.status === LineStatus.RUNNING).forEach(l => {
      if (l.subLines && l.subLines.length > 0) {
        l.subLines.forEach(sub => {
          if (sub.currentStyle && sub.currentStyle !== '-' && (sub.exportCapacity || 0) > 0) {
            pending.push({ lineId: l.id, lineName: l.name, subLineId: sub.id, subLineName: sub.name, styleNo: sub.currentStyle, quantity: sub.exportCapacity || 0 });
          }
        });
      } else if (l.currentStyle && l.currentStyle !== '-' && (l.exportCapacity || 0) > 0) {
        pending.push({ lineId: l.id, lineName: l.name, styleNo: l.currentStyle, quantity: l.exportCapacity || 0 });
      }
    });
    return pending;
  }, [lines]);

  return (
    <>
      {/* 待入库队列 */}
      {pendingStockIn.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 px-4 md:px-6 py-3 md:py-4 border-b border-blue-100 dark:border-blue-800 flex items-center">
            <Factory className="text-blue-600 dark:text-blue-400 mr-2" size={isMobile ? 18 : 20} />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-sm md:text-base">{t('inv_pending_in')}</h3>
            <span className="ml-2 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full font-bold">{pendingStockIn.length}</span>
          </div>
          {isMobile ? (
            <div className="p-3 space-y-3">
              {pendingStockIn.map((item, idx) => (
                <div key={`${item.lineId}-${item.subLineName || 'main'}-${idx}`} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{item.styleNo}</span>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{item.quantity.toFixed(1)}t</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">{item.lineName}{item.subLineName ? ` · ${item.subLineName}` : ''}</div>
                  <button onClick={() => onOpenProductionIn(item)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">{t('inv_confirm_in')}</button>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left">{t('inv_line_source')}</th>
                  <th className="px-4 py-3 text-left">{t('table_style')}</th>
                  <th className="px-4 py-3 text-right">{t('inv_quantity')}</th>
                  <th className="px-4 py-3 text-center w-32">{t('table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {pendingStockIn.map((item, idx) => (
                  <tr key={`${item.lineId}-${item.subLineName || 'main'}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.lineName}{item.subLineName ? <span className="text-slate-400 ml-1">· {item.subLineName}</span> : ''}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-slate-100">{item.styleNo}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">{item.quantity.toFixed(1)}t</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => onOpenProductionIn(item)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition">{t('inv_confirm_in')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 库存管理 - 移动端卡片视图 */}
      {isMobile ? (
        <div className="space-y-3">
          <InventoryAlerts inventory={inventory} onSetSafetyStock={onSetSafetyStock} />
          <div className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center">
              <Package className="text-emerald-600 dark:text-emerald-400 mr-2" size={18}/><h3 className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">{t('inv_title')}</h3>
              <span className="ml-2 bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs px-1.5 py-0.5 rounded-full font-bold">{filteredInventory.length}</span>
            </div>
            <Filter size={14} className="text-emerald-600" />
          </div>
          <div className="space-y-2">
            <input type="text" value={filterStyleNo} onChange={e => onFilterStyleNoChange(e.target.value)} placeholder={t('filter_style_placeholder')} className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800" />
            <div className="flex gap-2">
              <select value={filterWarehouse} onChange={e => onFilterWarehouseChange(e.target.value)} className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800">
                <option value="all">{t('wh_all')}</option>
                <option value={WarehouseType.GENERAL}>{t('wh_general')}</option>
                <option value={WarehouseType.BONDED}>{t('wh_bonded')}</option>
              </select>
              <select value={filterPackage} onChange={e => onFilterPackageChange(e.target.value)} className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800">
                <option value="all">{t('pkg_all')}</option>
                {PACKAGE_SPECS.map(ps => <option key={ps} value={ps}>{ps}</option>)}
              </select>
            </div>
          </div>
          {filteredInventory.length === 0 && <div className="text-center py-8 text-slate-400">{t('inv_no_data')}</div>}
          {filteredInventory.map(item => {
            const key = `${item.styleNo}-${item.warehouseType}-${item.packageSpec}`;
            return (
              <div key={key} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{item.styleNo}</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{item.currentStock.toFixed(1)}t</span>
                </div>
                <div className="flex gap-1 mb-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{item.warehouseType === WarehouseType.BONDED ? t('wh_bonded') : t('wh_general')}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{item.packageSpec}</span>
                </div>
                <div className="flex items-center text-xs mb-2 gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400">A: {(item.gradeA || 0).toFixed(1)}t</span>
                  <span className="text-blue-600 dark:text-blue-400">B: {(item.gradeB || 0).toFixed(1)}t</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center text-xs text-slate-400">
                    {(item.lockedForToday || 0) > 0 && <span className="flex items-center text-blue-500 mr-2"><Lock size={10} className="mr-0.5" />{item.lockedForToday?.toFixed(1)}t</span>}
                    {(item.safetyStock || 0) > 0 && item.currentStock < (item.safetyStock || 0) && <span className="flex items-center text-amber-500"><Settings size={10} className="mr-0.5" />{t('inv_below_safety')}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {onStockIn && <button onClick={() => onOpenStockModal('in', item.styleNo, item.warehouseType, item.packageSpec)} className="p-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/50 rounded"><Plus size={14} /></button>}
                    {onStockOut && <button onClick={() => onOpenStockModal('out', item.styleNo, item.warehouseType, item.packageSpec)} className="p-1.5 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/50 rounded"><Minus size={14} /></button>}
                    <ActionMenu item={item} onShowHistory={onShowHistory} onOpenLockModal={onOpenLockModal} onOpenSafetyModal={onOpenSafetyModal} onGetTransactions={onGetTransactions} onLockStock={onLockStock} onUnlockStock={onUnlockStock} onSetSafetyStock={!!onSetSafetyStock} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 库存管理 - 桌面端表格 */
        <>
          <InventoryAlerts inventory={inventory} onSetSafetyStock={onSetSafetyStock} />
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 px-6 py-4 border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between">
              <div className="flex items-center">
                <Package className="text-emerald-600 dark:text-emerald-400 mr-2" size={20}/><h3 className="font-semibold text-emerald-900 dark:text-emerald-100">{t('inv_title')}</h3>
                <span className="ml-2 bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs px-2 py-0.5 rounded-full font-bold">{filteredInventory.length}</span>
              </div>
              <div className="flex gap-2">
                <input type="text" value={filterStyleNo} onChange={e => onFilterStyleNoChange(e.target.value)} placeholder={t('filter_style_placeholder')} className="text-sm border border-emerald-200 dark:border-emerald-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 w-32" />
                <select value={filterWarehouse} onChange={e => onFilterWarehouseChange(e.target.value)} className="text-sm border border-emerald-200 dark:border-emerald-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800">
                  <option value="all">{t('wh_all')}</option>
                  <option value={WarehouseType.GENERAL}>{t('wh_general')}</option>
                  <option value={WarehouseType.BONDED}>{t('wh_bonded')}</option>
                </select>
                <select value={filterPackage} onChange={e => onFilterPackageChange(e.target.value)} className="text-sm border border-emerald-200 dark:border-emerald-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800">
                  <option value="all">{t('pkg_all')}</option>
                  {PACKAGE_SPECS.map(ps => <option key={ps} value={ps}>{ps}</option>)}
                </select>
                <button onClick={onOpenAuditLogs} className="flex items-center px-3 py-1.5 text-sm border border-emerald-200 dark:border-emerald-700 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" title={t('inv_audit_log')}><History size={14} className="mr-1" />{t('inv_audit_log')}</button>
                <button onClick={onExport} disabled={exporting} className="flex items-center px-3 py-1.5 text-sm border border-emerald-200 dark:border-emerald-700 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50" title={t('btn_export')}><Package size={14} className="mr-1" />{exporting ? t('inv_exporting') : t('btn_export')}</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left">{t('table_style')}</th>
                    <th className="px-4 py-3 text-left">{t('wh_type')}</th>
                    <th className="px-4 py-3 text-left">{t('pkg_spec')}</th>
                    <th className="px-4 py-3 text-right">{t('grade_a')}</th>
                    <th className="px-4 py-3 text-right">{t('grade_b')}</th>
                    <th className="px-4 py-3 text-right">{t('inv_current_stock')}</th>
                    <th className="px-4 py-3 text-center w-40">{t('table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {pagedInventory.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">{t('inv_no_data')}</td></tr>}
                  {pagedInventory.map(item => {
                    const key = `${item.styleNo}-${item.warehouseType}-${item.packageSpec}`;
                    return (
                      <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                        <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-slate-100">{item.styleNo}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${item.warehouseType === WarehouseType.BONDED ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{item.warehouseType === WarehouseType.BONDED ? t('wh_bonded') : t('wh_general')}</span></td>
                        <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{item.packageSpec}</span></td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{(item.gradeA || 0).toFixed(1)}t</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{(item.gradeB || 0).toFixed(1)}t</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">{item.currentStock.toFixed(1)}t</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center space-x-1">
                            {onStockIn && <button onClick={() => onOpenStockModal('in', item.styleNo, item.warehouseType, item.packageSpec)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 rounded" title={t('inv_in')}><Plus size={14} /></button>}
                            {onStockOut && <button onClick={() => onOpenStockModal('out', item.styleNo, item.warehouseType, item.packageSpec)} className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/50 rounded" title={t('inv_out')}><Minus size={14} /></button>}
                            <ActionMenu item={item} onShowHistory={onShowHistory} onOpenLockModal={onOpenLockModal} onOpenSafetyModal={onOpenSafetyModal} onGetTransactions={onGetTransactions} onLockStock={onLockStock} onUnlockStock={onUnlockStock} onSetSafetyStock={!!onSetSafetyStock} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500">{filteredInventory.length} {t('stocktake_items')}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50">{t('inc_prev_page')}</button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50">{t('inc_next_page')}</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default InventorySection;
