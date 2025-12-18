import React from 'react';
import { Order, InventoryItem, WarehouseType, PackageSpec, InventoryTransactionDisplay, StockModalState, StockForm, LockModalState, LockForm, SafetyModalState } from '../../types';
import { useLanguage } from '../../i18n';
import { Plus, Minus, Edit2, History, Lock, Settings, AlertOctagon, Factory, FileText } from 'lucide-react';
import { Modal } from '../common';


interface WarehouseModalsProps {
  inventory: InventoryItem[];
  showStockModal: StockModalState | null;
  stockForm: StockForm;
  showHistoryModal: string | null;
  transactions: InventoryTransactionDisplay[];
  showIncidentModal: boolean;
  selectedOrder: Order | null;
  incidentReason: string;
  incidentNote: string;
  showLockModal: LockModalState | null;
  lockForm: LockForm;
  showSafetyModal: SafetyModalState | null;
  safetyStock: number;
  showAuditModal: boolean;
  auditLogs: any[];
  auditPage: number;
  auditTotal: number;
  onCloseStockModal: () => void;
  onStockFormChange: (form: StockForm) => void;
  onStockSubmit: () => void;
  onCloseHistoryModal: () => void;
  onCloseIncidentModal: () => void;
  onIncidentReasonChange: (v: string) => void;
  onIncidentNoteChange: (v: string) => void;
  onSubmitIncident: () => void;
  onCloseLockModal: () => void;
  onLockFormChange: (form: LockForm) => void;
  onLockSubmit: () => void;
  onCloseSafetyModal: () => void;
  onSafetyStockChange: (v: number) => void;
  onSafetySubmit: () => void;
  onCloseAuditModal: () => void;
  onAuditPageChange: (page: number) => void;
}

const WarehouseModals: React.FC<WarehouseModalsProps> = ({
  inventory, showStockModal, stockForm, showHistoryModal, transactions, showIncidentModal, selectedOrder, incidentReason, incidentNote,
  showLockModal, lockForm, showSafetyModal, safetyStock, showAuditModal, auditLogs, auditPage, auditTotal,
  onCloseStockModal, onStockFormChange, onStockSubmit, onCloseHistoryModal, onCloseIncidentModal, onIncidentReasonChange, onIncidentNoteChange, onSubmitIncident,
  onCloseLockModal, onLockFormChange, onLockSubmit, onCloseSafetyModal, onSafetyStockChange, onSafetySubmit, onCloseAuditModal, onAuditPageChange
}) => {
  const { t } = useLanguage();

  return (
    <>
      {/* 库存操作弹窗 */}
      <Modal isOpen={showStockModal !== null} onClose={onCloseStockModal} title={showStockModal?.type === 'edit' ? t('inv_manual_adjust') : showStockModal?.type === 'production' ? t('inv_production_in') : showStockModal?.type === 'in' ? t('inv_in') : t('inv_out')} titleIcon={showStockModal?.type === 'production' ? <Factory size={20} /> : showStockModal?.type === 'edit' ? <Edit2 size={20} /> : showStockModal?.type === 'in' ? <Plus size={20} /> : <Minus size={20} />}>
        {showStockModal && (() => {
          const isEdit = showStockModal.type === 'edit';
          const isIn = showStockModal.type === 'in' || showStockModal.type === 'production';
          const newGradeA = isEdit ? stockForm.gradeA : (isIn ? stockForm.gradeA + stockForm.quantity : stockForm.gradeA - stockForm.quantity);
          const newTotal = isEdit ? (stockForm.gradeA + stockForm.gradeB) : (stockForm.gradeA + stockForm.gradeB + (isIn ? stockForm.quantity : -stockForm.quantity));
          return (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm">
                <div className="flex justify-between"><span className="text-slate-500">{t('table_style')}:</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{showStockModal.styleNo}</span></div>
                <div className="flex justify-between mt-1"><span className="text-slate-500">{t('wh_type')}:</span><span className="text-slate-700 dark:text-slate-300">{showStockModal.warehouseType === WarehouseType.BONDED ? t('wh_bonded') : t('wh_general')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t('pkg_spec')}:</span><span className="text-slate-700 dark:text-slate-300">{showStockModal.packageSpec}</span></div>
              </div>
              {isEdit ? (() => {
                const item = inventory.find(i => i.styleNo === showStockModal.styleNo && i.warehouseType === showStockModal.warehouseType && i.packageSpec === showStockModal.packageSpec);
                const origA = item?.gradeA || 0;
                const origB = item?.gradeB || 0;
                const diffA = stockForm.gradeA - origA;
                const diffB = stockForm.gradeB - origB;
                const hasChange = diffA !== 0 || diffB !== 0;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('grade_a')} (t)</label><input type="number" step="0.1" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={stockForm.gradeA} onChange={(e) => onStockFormChange({ ...stockForm, gradeA: parseFloat(e.target.value) || 0 })} /></div>
                      <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('grade_b')} (t)</label><input type="number" step="0.1" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={stockForm.gradeB} onChange={(e) => onStockFormChange({ ...stockForm, gradeB: parseFloat(e.target.value) || 0 })} /></div>
                    </div>
                    {hasChange && (
                      <div className="p-3 rounded-lg text-sm bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                        <div className="font-medium mb-2 text-slate-700 dark:text-slate-200">{t('inv_preview')}</div>
                        <div className="flex justify-between"><span className="text-slate-500">{t('grade_a')}:</span><span className="font-mono">{origA.toFixed(1)}t {'->'} {stockForm.gradeA.toFixed(1)}t <span className={diffA > 0 ? 'text-emerald-600' : diffA < 0 ? 'text-orange-600' : ''}>({diffA > 0 ? '+' : ''}{diffA.toFixed(1)})</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-500">{t('grade_b')}:</span><span className="font-mono">{origB.toFixed(1)}t {'->'} {stockForm.gradeB.toFixed(1)}t <span className={diffB > 0 ? 'text-emerald-600' : diffB < 0 ? 'text-orange-600' : ''}>({diffB > 0 ? '+' : ''}{diffB.toFixed(1)})</span></span></div>
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 mt-2 pt-2"><span className="text-slate-600 dark:text-slate-400 font-medium">{t('inv_current_stock')}:</span><span className="font-mono font-bold">{(origA + origB).toFixed(1)}t {'->'} {(stockForm.gradeA + stockForm.gradeB).toFixed(1)}t</span></div>
                      </div>
                    )}
                  </>
                );
              })() : (
                <>
                  <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inv_quantity')} (t)</label><input type="number" step="0.1" min="0" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={stockForm.quantity} onChange={(e) => onStockFormChange({ ...stockForm, quantity: parseFloat(e.target.value) || 0 })} /></div>
                  {stockForm.quantity > 0 && (
                    <div className={`p-3 rounded-lg text-sm ${isIn ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800' : 'bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800'}`}>
                      <div className="font-medium mb-2 text-slate-700 dark:text-slate-200">{t('inv_preview')}</div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('grade_a')}:</span><span className="font-mono">{stockForm.gradeA.toFixed(1)}t {'->'} <span className={isIn ? 'text-emerald-600' : 'text-orange-600'}>{newGradeA.toFixed(1)}t</span></span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('grade_b')}:</span><span className="font-mono">{stockForm.gradeB.toFixed(1)}t</span></div>
                      <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 mt-2 pt-2"><span className="text-slate-600 dark:text-slate-400 font-medium">{t('inv_current_stock')}:</span><span className="font-mono font-bold">{(stockForm.gradeA + stockForm.gradeB).toFixed(1)}t {'->'} <span className={isIn ? 'text-emerald-600' : 'text-orange-600'}>{newTotal.toFixed(1)}t</span></span></div>
                    </div>
                  )}
                  <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inv_source')}</label><input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={stockForm.source} onChange={(e) => onStockFormChange({ ...stockForm, source: e.target.value })} /></div>
                  <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inv_note')}</label><textarea className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm h-12 dark:bg-slate-800" value={stockForm.note} onChange={(e) => onStockFormChange({ ...stockForm, note: e.target.value })} /></div>
                </>
              )}
              <button onClick={onStockSubmit} disabled={!isEdit && stockForm.quantity <= 0} className={`w-full py-2.5 text-white rounded-lg font-medium transition ${showStockModal.type === 'out' ? 'bg-orange-600 hover:bg-orange-700' : showStockModal.type === 'production' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}>{t('inv_confirm')}</button>
            </div>
          );
        })()}
      </Modal>

      {/* 流水历史弹窗 */}
      <Modal isOpen={showHistoryModal !== null} onClose={onCloseHistoryModal} title={`${showHistoryModal} ${t('inv_transaction_history')}`} titleIcon={<History size={20} />} size="xl">
        <div className="max-h-80 overflow-x-auto overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t('inv_no_transactions')}</p>
          ) : (
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-slate-50 text-slate-500 text-xs sticky top-0">
                <tr><th className="px-2 py-2 text-left whitespace-nowrap">{t('inv_type_in')}/{t('inv_type_out')}</th><th className="px-2 py-2 text-left whitespace-nowrap">{t('pkg_spec')}</th><th className="px-2 py-2 text-left whitespace-nowrap">{t('grade_label')}</th><th className="px-2 py-2 text-right whitespace-nowrap">{t('inv_quantity')}</th><th className="px-2 py-2 text-right whitespace-nowrap">{t('inv_balance')}</th><th className="px-2 py-2 text-left whitespace-nowrap">{t('inv_time')}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 whitespace-nowrap"><span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${tx.type.includes('IN') ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{tx.type === 'ADJUST_IN' ? t('inv_adjust_in') : tx.type === 'ADJUST_OUT' ? t('inv_adjust_out') : tx.type === 'IN' ? t('inv_type_in') : t('inv_type_out')}</span></td>
                    <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">{tx.warehouseType === 'bonded' ? t('wh_bonded') : t('wh_general')}/{tx.packageSpec || '820kg'}</td>
                    <td className="px-2 py-2 whitespace-nowrap"><span className={`px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${tx.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-50 text-emerald-600'}`}>{tx.grade === 'B' ? t('grade_b') : t('grade_a')}</span></td>
                    <td className="px-2 py-2 text-right font-mono whitespace-nowrap">{tx.type.includes('IN') ? '+' : '-'}{tx.quantity.toFixed(1)}t</td>
                    <td className="px-2 py-2 text-right font-mono text-slate-600 whitespace-nowrap">{tx.balance.toFixed(1)}t</td>
                    <td className="px-2 py-2 text-slate-400 text-xs whitespace-nowrap">{new Date(tx.createdAt + 'Z').toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* 异常上报弹窗 */}
      <Modal isOpen={showIncidentModal} onClose={onCloseIncidentModal} title={t('modal_incident_title')} titleIcon={<AlertOctagon size={20} />} titleClassName="text-red-600">
        {selectedOrder && (
          <>
            <div className="bg-slate-50 p-3 rounded-lg mb-4 text-sm">
              <p><span className="font-semibold">{t('table_client')}:</span> {selectedOrder.client}</p>
              <p><span className="font-semibold">{t('table_style')}:</span> {selectedOrder.styleNo}</p>
              <p><span className="font-semibold">{t('table_total')}:</span> {selectedOrder.totalTons} t</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_reason')}</label>
                <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none" value={incidentReason} onChange={e => onIncidentReasonChange(e.target.value)}>
                  <option value="stock_taken">{t('reason_stock_taken')}</option>
                  <option value="prod_delay">{t('reason_prod_delay')}</option>
                  <option value="quality_issue">{t('reason_quality')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_notes')}</label>
                <textarea className="w-full border border-slate-300 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-red-500 outline-none" placeholder={t('incident_note_placeholder')} value={incidentNote} onChange={(e) => onIncidentNoteChange(e.target.value)} />
              </div>
              <button onClick={onSubmitIncident} className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition">{t('btn_submit_report')}</button>
            </div>
          </>
        )}
      </Modal>

      {/* 库存锁定/解锁弹窗 */}
      <Modal isOpen={showLockModal !== null} onClose={onCloseLockModal} title={t('inv_lock_manage')} titleIcon={<Lock size={20} />}>
        {showLockModal && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{t('table_style')}:</span><span className="font-mono font-bold">{showLockModal.styleNo}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('inv_current_stock')}:</span><span className="font-mono">{showLockModal.currentStock.toFixed(1)}t</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('inv_locked_qty')}:</span><span className="font-mono text-blue-600">{showLockModal.currentLocked.toFixed(1)}t</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('inv_available_qty')}:</span><span className="font-mono text-emerald-600">{(showLockModal.currentStock - showLockModal.currentLocked).toFixed(1)}t</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inv_quantity')} (+{t('inv_lock')}/-{t('inv_unlock')})</label>
              <input type="number" step="0.1" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={lockForm.quantity} onChange={e => onLockFormChange({ ...lockForm, quantity: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('label_reason')}</label>
              <input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={lockForm.reason} onChange={e => onLockFormChange({ ...lockForm, reason: e.target.value })} />
            </div>
            <button onClick={onLockSubmit} disabled={lockForm.quantity === 0} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">{lockForm.quantity >= 0 ? t('inv_lock') : t('inv_unlock')}</button>
          </div>
        )}
      </Modal>

      {/* 安全库存设置弹窗 */}
      <Modal isOpen={showSafetyModal !== null} onClose={onCloseSafetyModal} title={t('inv_set_safety')} titleIcon={<Settings size={20} />}>
        {showSafetyModal && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{t('table_style')}:</span><span className="font-mono font-bold">{showSafetyModal.styleNo}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('inv_safety_stock')}:</span><span className="font-mono">{showSafetyModal.currentSafety.toFixed(1)}t</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inv_safety_stock')} (t)</label>
              <input type="number" step="0.1" min="0" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={safetyStock} onChange={e => onSafetyStockChange(parseFloat(e.target.value) || 0)} />
            </div>
            <button onClick={onSafetySubmit} className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition">{t('btn_save')}</button>
          </div>
        )}
      </Modal>

      {/* 审计日志弹窗 */}
      <Modal isOpen={showAuditModal} onClose={onCloseAuditModal} title={t('inv_audit_log')} titleIcon={<FileText size={20} />} size="xl">
        <div className="max-h-96 overflow-x-auto overflow-y-auto">
          {auditLogs.length === 0 ? <p className="text-center text-slate-400 py-4">{t('inv_no_transactions')}</p> : (
            <>
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-20">{t('inv_time')}</th>
                    <th className="px-3 py-2 text-left w-20">{t('table_style')}</th>
                    <th className="px-3 py-2 text-left w-28">{t('pkg_spec')}</th>
                    <th className="px-3 py-2 text-left w-16">{t('table_actions')}</th>
                    <th className="px-3 py-2 text-left w-44 whitespace-nowrap">{t('inv_before')}/{t('inv_after')}</th>
                    <th className="px-3 py-2 text-left">{t('label_reason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-2 font-mono text-xs">{log.styleNo}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{log.warehouseType === 'bonded' ? t('wh_bonded') : t('wh_general')}/{log.packageSpec || '820kg'}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${log.action === 'adjust' ? 'bg-blue-100 text-blue-700' : log.action === 'lock' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{log.action === 'adjust' ? t('inv_stocktake') : log.action === 'lock' ? t('inv_lock') : t('inv_unlock')}</span></td>
                      <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">A:{log.beforeGradeA}→{log.afterGradeA} B:{log.beforeGradeB}→{log.afterGradeB}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-40">{log.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditTotal > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-3 pt-3 border-t">
                  <button onClick={() => onAuditPageChange(auditPage - 1)} disabled={auditPage <= 1} className="px-2 py-1 text-xs border rounded disabled:opacity-50">{t('inc_prev_page')}</button>
                  <span className="text-xs text-slate-500">{auditPage} / {auditTotal}</span>
                  <button onClick={() => onAuditPageChange(auditPage + 1)} disabled={auditPage >= auditTotal} className="px-2 py-1 text-xs border rounded disabled:opacity-50">{t('inc_next_page')}</button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default WarehouseModals;
