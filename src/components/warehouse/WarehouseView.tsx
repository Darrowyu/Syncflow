import React, { useState } from 'react';
import { Order, OrderStatus, IncidentLog, LoadingTimeSlot, WorkshopCommStatus, InventoryItem, ProductLine, LineStatus } from '../../types';
import { useLanguage } from '../../i18n';
import { Truck, CheckCircle, AlertTriangle, AlertOctagon, Clock, Package, Edit2, Plus, Minus, History, Factory, Check, Trash2 } from 'lucide-react';
import { Modal } from '../common';
import { generateId } from '../../utils';

interface WarehouseViewProps {
  orders: Order[];
  inventory: InventoryItem[];
  lines: ProductLine[];
  incidents: IncidentLog[];
  onConfirmLoad: (orderId: string) => void;
  onLogIncident: (incident: IncidentLog) => void;
  onResolveIncident?: (id: string, resolved: boolean) => void;
  onDeleteIncident?: (id: string) => void;
  onStockIn?: (styleNo: string, quantity: number, grade?: string, source?: string, note?: string) => Promise<number>;
  onStockOut?: (styleNo: string, quantity: number, grade?: string, source?: string, note?: string) => Promise<number>;
  onUpdateStock?: (styleNo: string, gradeA: number, gradeB: number) => Promise<void>;
  onGetTransactions?: (styleNo?: string) => Promise<any[]>;
  onProductionIn?: (styleNo: string, quantity: number, grade?: string) => Promise<void>;
}

interface Transaction { id: number; styleNo: string; type: string; grade?: string; quantity: number; balance: number; source?: string; note?: string; createdAt: string; }

const WarehouseView: React.FC<WarehouseViewProps> = ({ orders, inventory, lines, incidents, onConfirmLoad, onLogIncident, onResolveIncident, onDeleteIncident, onStockIn, onStockOut, onUpdateStock, onGetTransactions, onProductionIn }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'incidents'>('inventory');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [incidentReason, setIncidentReason] = useState('stock_taken');
  const [incidentNote, setIncidentNote] = useState('');
  const [showStockModal, setShowStockModal] = useState<{ type: 'in' | 'out' | 'edit' | 'production'; styleNo: string } | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: 0, grade: 'A', gradeA: 0, gradeB: 0, source: '', note: '' });
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const pendingLoadOrders = orders.filter(o => o.status === OrderStatus.READY_TO_SHIP);
  const shippedOrders = orders.filter(o => o.status === OrderStatus.SHIPPED);

  // 计算各款号的生产产能
  const getStyleProduction = (styleNo: string): number => {
    let total = 0;
    lines.filter(l => l.status === LineStatus.RUNNING).forEach(l => {
      if (l.subLines && l.subLines.length > 0) {
        l.subLines.filter(sub => sub.currentStyle === styleNo).forEach(sub => { total += sub.exportCapacity || 0; });
      } else if (l.currentStyle === styleNo) { total += l.exportCapacity || 0; }
    });
    return total;
  };

  const handleOpenIncident = (order: Order) => { setSelectedOrder(order); setShowIncidentModal(true); };

  const handleSubmitIncident = () => {
    if (!selectedOrder) return;
    onLogIncident({ id: generateId(), timestamp: new Date().toLocaleString(), styleNo: selectedOrder.styleNo, orderClient: selectedOrder.client, reportedBy: 'Warehouse Team', reason: incidentReason, note: incidentNote });
    setShowIncidentModal(false); setIncidentNote(''); setSelectedOrder(null);
  };

  const getLoadingTimeText = (slot?: LoadingTimeSlot) => {
    switch (slot) {
      case LoadingTimeSlot.MORNING: return t('loading_morning');
      case LoadingTimeSlot.AFTERNOON: return t('loading_afternoon');
      default: return t('loading_flexible');
    }
  };

  const getWorkshopStatusOk = (status?: WorkshopCommStatus) => status === WorkshopCommStatus.CONFIRMED;

  const handleOpenStockModal = (type: 'in' | 'out' | 'edit' | 'production', styleNo: string) => {
    const item = inventory.find(i => i.styleNo === styleNo);
    setStockForm({ quantity: type === 'production' ? getStyleProduction(styleNo) : 0, grade: 'A', gradeA: item?.gradeA || 0, gradeB: item?.gradeB || 0, source: type === 'production' ? t('inv_production_in') : '', note: '' });
    setShowStockModal({ type, styleNo });
  };

  const handleStockSubmit = async () => {
    if (!showStockModal) return;
    const { type, styleNo } = showStockModal;
    try {
      if (type === 'edit' && onUpdateStock) { await onUpdateStock(styleNo, stockForm.gradeA, stockForm.gradeB); }
      else if (type === 'production' && onProductionIn) { await onProductionIn(styleNo, stockForm.quantity, stockForm.grade); }
      else if (type === 'in' && onStockIn) { await onStockIn(styleNo, stockForm.quantity, stockForm.grade, stockForm.source, stockForm.note); }
      else if (type === 'out' && onStockOut) { await onStockOut(styleNo, stockForm.quantity, stockForm.grade, stockForm.source, stockForm.note); }
      setShowStockModal(null);
    } catch (e) { alert((e as Error).message); }
  };

  const handleShowHistory = async (styleNo: string) => {
    setShowHistoryModal(styleNo);
    if (onGetTransactions) {
      const data = await onGetTransactions(styleNo);
      setTransactions(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
          <button onClick={() => setActiveTab('inventory')} className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('inv_title')}</button>
          <button onClick={() => setActiveTab('orders')} className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === 'orders' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('wh_pending_load')}</button>
          <button onClick={() => setActiveTab('incidents')} className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === 'incidents' ? 'bg-white dark:bg-slate-700 shadow text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('incident_log')}</button>
        </div>
      </div>

      {/* 库存管理Tab */}
      {activeTab === 'inventory' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 px-6 py-4 border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between">
            <div className="flex items-center">
              <Package className="text-emerald-600 dark:text-emerald-400 mr-2" size={20}/><h3 className="font-semibold text-emerald-900 dark:text-emerald-100">{t('inv_title')}</h3>
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
                  <th className="px-4 py-3 text-right">{t('today_production')}</th>
                  <th className="px-4 py-3 text-center w-48">{t('table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {inventory.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">{t('inv_no_data')}</td></tr>}
                {inventory.map(item => {
                  const production = getStyleProduction(item.styleNo);
                  return (
                    <tr key={item.styleNo} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-slate-100">{item.styleNo}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{(item.gradeA || 0).toFixed(1)}t</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{(item.gradeB || 0).toFixed(1)}t</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">{item.currentStock.toFixed(1)}t</td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">{production > 0 ? `${production.toFixed(1)}t` : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center space-x-1">
                          {production > 0 && onProductionIn && (
                            <button onClick={() => handleOpenStockModal('production', item.styleNo)} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center" title={t('inv_production_in')}><Factory size={12} className="mr-1" />{t('stock_in_btn')}</button>
                          )}
                          {onStockIn && <button onClick={() => handleOpenStockModal('in', item.styleNo)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 rounded" title={t('inv_in')}><Plus size={14} /></button>}
                          {onStockOut && <button onClick={() => handleOpenStockModal('out', item.styleNo)} className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/50 rounded" title={t('inv_out')}><Minus size={14} /></button>}
                          {onUpdateStock && <button onClick={() => handleOpenStockModal('edit', item.styleNo)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title={t('inv_edit')}><Edit2 size={14} /></button>}
                          {onGetTransactions && <button onClick={() => handleShowHistory(item.styleNo)} className="p-1.5 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded" title={t('inv_history')}><History size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* 待装车Tab */}
      {activeTab === 'orders' && (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 px-6 py-4 border-b border-indigo-100 dark:border-indigo-800 flex items-center">
              <Truck className="text-indigo-600 dark:text-indigo-400 mr-2" size={20}/><h3 className="font-semibold text-indigo-900 dark:text-indigo-100">{t('wh_pending_load')}</h3>
              <span className="ml-2 bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs px-2 py-0.5 rounded-full font-bold">{pendingLoadOrders.length}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {pendingLoadOrders.length === 0 && <div className="p-8 text-center text-slate-400 dark:text-slate-500">{t('no_orders_load')}</div>}
              {pendingLoadOrders.map(order => (
                <div key={order.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition ${!getWorkshopStatusOk(order.workshopCommStatus) ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">{order.client}</span>
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                        {order.isLargeOrder && <span className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-0.5 rounded text-xs font-bold">{t('tag_large')}</span>}
                        <span className="flex items-center text-xs text-slate-500 dark:text-slate-400"><Clock size={12} className="mr-1" />{getLoadingTimeText(order.loadingTimeSlot)}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_po')}</span><p className="font-mono text-xs">{order.piNo}</p></div>
                        <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_bl')}</span><p className="font-mono text-xs">{order.blNo || '-'}</p></div>
                        <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_total')}</span><p className="font-semibold">{order.totalTons} t</p></div>
                        <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_containers')}</span><p>{order.containers} ({order.packagesPerContainer}{t('table_pkg_per_cont')})</p></div>
                        <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_port')}</span><p>{order.port}</p></div>
                        <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_contact')}</span><p><span className="bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs">{order.contactPerson}</span></p></div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded">{t('table_requirements')}: {order.requirements}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {!getWorkshopStatusOk(order.workshopCommStatus) && <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">{t('ws_in_progress')}</span>}
                      <button onClick={() => handleOpenIncident(order)} className="flex items-center px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-medium transition"><AlertTriangle size={16} className="mr-2" />{t('btn_report_issue')}</button>
                      <button onClick={() => onConfirmLoad(order.id)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm text-sm font-medium transition"><CheckCircle size={18} className="mr-2" />{t('btn_confirm_load')}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {shippedOrders.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/30 px-6 py-4 border-b border-green-100 dark:border-green-800 flex items-center">
                <Package className="text-green-600 dark:text-green-400 mr-2" size={20}/><h3 className="font-semibold text-green-900 dark:text-green-100">{t('wh_shipped_today')}</h3>
                <span className="ml-2 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full font-bold">{shippedOrders.length}</span>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead className="text-slate-500 dark:text-slate-400 text-xs"><tr><th className="text-left py-2">{t('table_client')}</th><th className="text-left">{t('table_style')}</th><th className="text-right">{t('table_total')}</th><th className="text-center">{t('table_containers')}</th><th className="text-left">{t('table_port')}</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {shippedOrders.map(o => (<tr key={o.id} className="text-slate-600 dark:text-slate-300"><td className="py-2 font-medium">{o.client}</td><td className="font-mono text-xs">{o.styleNo}</td><td className="text-right">{o.totalTons}t</td><td className="text-center">{o.containers}</td><td>{o.port}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 异常记录Tab */}
      {activeTab === 'incidents' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-red-50 dark:bg-red-900/30 px-6 py-4 border-b border-red-100 dark:border-red-800 flex items-center">
            <AlertOctagon className="text-red-600 dark:text-red-400 mr-2" size={20}/><h3 className="font-semibold text-red-900 dark:text-red-100">{t('incident_log')}</h3>
            <span className="ml-2 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs px-2 py-0.5 rounded-full font-bold">{incidents.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
                <tr><th className="px-4 py-3 text-left">{t('table_date')}</th><th className="px-4 py-3 text-left">{t('table_style')}</th><th className="px-4 py-3 text-left">{t('table_client')}</th><th className="px-4 py-3 text-left">{t('label_reason')}</th><th className="px-4 py-3 text-left">{t('label_notes')}</th><th className="px-4 py-3 text-center">{t('workshop_status')}</th><th className="px-4 py-3 text-center w-24">{t('table_actions')}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {incidents.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">{t('no_incidents')}</td></tr>}
                {incidents.map(inc => (
                  <tr key={inc.id} className={inc.resolved ? 'bg-slate-50 dark:bg-slate-900 opacity-60' : ''}>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{inc.timestamp}</td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{inc.styleNo}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{inc.orderClient || '-'}</td>
                    <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{t(`reason_${inc.reason}` as any) || inc.reason}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{inc.note}</td>
                    <td className="px-4 py-3 text-center">{inc.resolved ? <div><span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-xs">{t('status_resolved')}</span>{inc.resolvedAt && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(inc.resolvedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}</div> : <span className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-xs">{t('status_pending_resolve')}</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center space-x-1">
                        {!inc.resolved && onResolveIncident && <button onClick={() => onResolveIncident(inc.id, true)} className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50 rounded" title={t('mark_resolved')}><Check size={14} /></button>}
                        {inc.resolved && onResolveIncident && <button onClick={() => onResolveIncident(inc.id, false)} className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/50 rounded" title={t('reopen')}><AlertTriangle size={14} /></button>}
                        {onDeleteIncident && <button onClick={() => { if (confirm(t('confirm_delete_record'))) onDeleteIncident(inc.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 库存操作弹窗 */}
      <Modal isOpen={showStockModal !== null} onClose={() => setShowStockModal(null)} title={showStockModal?.type === 'edit' ? t('inv_manual_adjust') : showStockModal?.type === 'production' ? t('inv_production_in') : showStockModal?.type === 'in' ? t('inv_in') : t('inv_out')} titleIcon={showStockModal?.type === 'production' ? <Factory size={20} /> : showStockModal?.type === 'edit' ? <Edit2 size={20} /> : showStockModal?.type === 'in' ? <Plus size={20} /> : <Minus size={20} />}>
        {showStockModal && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{t('table_style')}:</span><span className="font-mono font-bold text-slate-800">{showStockModal.styleNo}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">{t('grade_a')}:</span><span className="font-mono text-emerald-600">{(inventory.find(i => i.styleNo === showStockModal.styleNo)?.gradeA || 0).toFixed(1)}t</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('grade_b')}:</span><span className="font-mono text-blue-600">{(inventory.find(i => i.styleNo === showStockModal.styleNo)?.gradeB || 0).toFixed(1)}t</span></div>
            </div>
            {showStockModal.type === 'edit' ? (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">{t('grade_a')} (t)</label><input type="number" step="0.1" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={stockForm.gradeA} onChange={(e) => setStockForm({ ...stockForm, gradeA: parseFloat(e.target.value) || 0 })} /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">{t('grade_b')} (t)</label><input type="number" step="0.1" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={stockForm.gradeB} onChange={(e) => setStockForm({ ...stockForm, gradeB: parseFloat(e.target.value) || 0 })} /></div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">{t('grade_label')}</label><select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={stockForm.grade} onChange={(e) => setStockForm({ ...stockForm, grade: e.target.value })}><option value="A">{t('grade_a_option')}</option><option value="B">{t('grade_b_option')}</option></select></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">{t('inv_quantity')}</label><input type="number" step="0.1" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">{t('inv_source')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={stockForm.source} onChange={(e) => setStockForm({ ...stockForm, source: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">{t('inv_note')}</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm h-12" value={stockForm.note} onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })} /></div>
              </>
            )}
            <button onClick={handleStockSubmit} disabled={showStockModal.type !== 'edit' && stockForm.quantity <= 0} className={`w-full py-2.5 text-white rounded-lg font-medium transition ${showStockModal.type === 'out' ? 'bg-orange-600 hover:bg-orange-700' : showStockModal.type === 'production' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}>{t('inv_confirm')}</button>
          </div>
        )}
      </Modal>

      {/* 流水历史弹窗 */}
      <Modal isOpen={showHistoryModal !== null} onClose={() => setShowHistoryModal(null)} title={`${showHistoryModal} ${t('inv_transaction_history')}`} titleIcon={<History size={20} />}>
        <div className="max-h-80 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t('inv_no_transactions')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs sticky top-0">
                <tr><th className="px-2 py-2 text-left">类型</th><th className="px-2 py-2 text-left">等级</th><th className="px-2 py-2 text-right">{t('inv_quantity')}</th><th className="px-2 py-2 text-right">{t('inv_balance')}</th><th className="px-2 py-2 text-left">{t('inv_time')}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{tx.type === 'IN' ? t('inv_type_in') : t('inv_type_out')}</span></td>
                    <td className="px-2 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${tx.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-50 text-emerald-600'}`}>{tx.grade === 'B' ? t('grade_b') : t('grade_a')}</span></td>
                    <td className="px-2 py-2 text-right font-mono">{tx.type === 'IN' ? '+' : '-'}{tx.quantity.toFixed(1)}t</td>
                    <td className="px-2 py-2 text-right font-mono text-slate-600">{tx.balance.toFixed(1)}t</td>
                    <td className="px-2 py-2 text-slate-400 text-xs">{new Date(tx.createdAt + 'Z').toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* 异常上报弹窗 */}
      <Modal isOpen={showIncidentModal} onClose={() => setShowIncidentModal(false)} title={t('modal_incident_title')} titleIcon={<AlertOctagon size={20} />} titleClassName="text-red-600">
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
                <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none" value={incidentReason} onChange={(e) => setIncidentReason(e.target.value)}>
                  <option value="stock_taken">{t('reason_stock_taken')}</option>
                  <option value="prod_delay">{t('reason_prod_delay')}</option>
                  <option value="quality_issue">{t('reason_quality')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_notes')}</label>
                <textarea className="w-full border border-slate-300 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-red-500 outline-none" placeholder={t('incident_note_placeholder')} value={incidentNote} onChange={(e) => setIncidentNote(e.target.value)} />
              </div>
              <button onClick={handleSubmitIncident} className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition">{t('btn_submit_report')}</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default WarehouseView;
