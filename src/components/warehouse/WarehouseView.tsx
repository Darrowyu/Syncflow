import React, { useState, useMemo } from 'react';
import { Order, IncidentLog, ProductLine, InventoryItem, WarehouseType, PackageSpec } from '../../types';
import { useLanguage } from '../../i18n';
import { toast } from '../common';
import { generateId } from '../../utils';
import { useIsMobile } from '../../hooks';
import { fetchInventoryAuditLogs } from '../../services/api';
import { exportInventoryToExcel } from '../../utils/excelExport';
import InventorySection from './InventorySection';
import OrdersSection from './OrdersSection';
import WarehouseModals from './WarehouseModals';

interface WarehouseViewProps {
  orders: Order[];
  inventory: InventoryItem[];
  lines: ProductLine[];
  incidents: IncidentLog[];
  onConfirmLoad: (orderId: string, autoDeductStock?: boolean) => void;
  onLogIncident: (incident: IncidentLog) => void;
  onResolveIncident?: (id: string, resolved: boolean) => void;
  onDeleteIncident?: (id: string) => void;
  onStockIn?: (styleNo: string, quantity: number, grade?: string, source?: string, note?: string, warehouseType?: string, packageSpec?: string) => Promise<number>;
  onStockOut?: (styleNo: string, quantity: number, grade?: string, source?: string, note?: string, warehouseType?: string, packageSpec?: string) => Promise<number>;
  onUpdateStock?: (styleNo: string, gradeA: number, gradeB: number, warehouseType?: string, packageSpec?: string, reason?: string) => Promise<void>;
  onGetTransactions?: (params?: any) => Promise<any>;
  onProductionIn?: (styleNo: string, quantity: number, grade?: string, warehouseType?: string, packageSpec?: string, lineId?: number, subLineId?: string) => Promise<void>;
  onSetSafetyStock?: (styleNo: string, safetyStock: number, warehouseType?: string, packageSpec?: string) => Promise<void>;
  onLockStock?: (styleNo: string, quantity: number, warehouseType?: string, packageSpec?: string, reason?: string) => Promise<number>;
  onUnlockStock?: (styleNo: string, quantity: number, warehouseType?: string, packageSpec?: string, reason?: string) => Promise<number>;
}

interface Transaction { id: number; styleNo: string; warehouseType?: string; packageSpec?: string; type: string; grade?: string; quantity: number; balance: number; source?: string; note?: string; createdAt: string; }
interface PendingItem { lineId: number; lineName: string; subLineId?: string; subLineName?: string; styleNo: string; quantity: number; }

const WarehouseView: React.FC<WarehouseViewProps> = ({ orders, inventory, lines, incidents, onConfirmLoad, onLogIncident, onResolveIncident, onDeleteIncident, onStockIn, onStockOut, onUpdateStock, onGetTransactions, onProductionIn, onSetSafetyStock, onLockStock, onUnlockStock }) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'pending' | 'inventory' | 'orders' | 'incidents'>('inventory');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [incidentReason, setIncidentReason] = useState('stock_taken');
  const [incidentNote, setIncidentNote] = useState('');
  const [showStockModal, setShowStockModal] = useState<{ type: 'in' | 'out' | 'edit' | 'production'; styleNo: string; warehouseType: string; packageSpec: string; lineId?: number; subLineId?: string; pendingQty?: number } | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: 0, grade: 'A', gradeA: 0, gradeB: 0, source: '', note: '', warehouseType: WarehouseType.GENERAL, packageSpec: PackageSpec.KG820 });
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  const [filterPackage, setFilterPackage] = useState<string>('all');
  const [filterStyleNo, setFilterStyleNo] = useState<string>('');
  const [showLockModal, setShowLockModal] = useState<{ styleNo: string; warehouseType: string; packageSpec: string; currentLocked: number; currentStock: number } | null>(null);
  const [lockForm, setLockForm] = useState({ quantity: 0, reason: '' });
  const [showSafetyModal, setShowSafetyModal] = useState<{ styleNo: string; warehouseType: string; packageSpec: string; currentSafety: number } | null>(null);
  const [safetyStock, setSafetyStock] = useState(0);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const filteredInventory = useMemo(() => {
    return inventory.filter(i => {
      if (filterWarehouse !== 'all' && i.warehouseType !== filterWarehouse) return false;
      if (filterPackage !== 'all' && i.packageSpec !== filterPackage) return false;
      if (filterStyleNo && !i.styleNo.toLowerCase().includes(filterStyleNo.toLowerCase())) return false;
      return true;
    });
  }, [inventory, filterWarehouse, filterPackage, filterStyleNo]);

  const hasPendingStockIn = useMemo(() => { // 检查是否有待入库
    return lines.some(l => l.subLines?.some(sub => sub.currentStyle && sub.currentStyle !== '-' && (sub.exportCapacity || 0) > 0) || (l.currentStyle && l.currentStyle !== '-' && (l.exportCapacity || 0) > 0));
  }, [lines]);

  const handleOpenIncident = (order: Order) => { setSelectedOrder(order); setShowIncidentModal(true); };

  const handleSubmitIncident = () => {
    if (!selectedOrder) return;
    onLogIncident({ id: generateId(), timestamp: new Date().toLocaleString(), styleNo: selectedOrder.styleNo, orderClient: selectedOrder.client, reportedBy: 'Warehouse Team', reason: incidentReason, note: incidentNote });
    setShowIncidentModal(false); setIncidentNote(''); setSelectedOrder(null);
  };

  const handleOpenStockModal = (type: 'in' | 'out' | 'edit' | 'production', styleNo: string, warehouseType?: string, packageSpec?: string) => {
    const wt = warehouseType || WarehouseType.GENERAL;
    const ps = packageSpec || PackageSpec.KG820;
    const item = inventory.find(i => i.styleNo === styleNo && i.warehouseType === wt && i.packageSpec === ps);
    setStockForm({ quantity: 0, grade: 'A', gradeA: item?.gradeA || 0, gradeB: item?.gradeB || 0, source: type === 'production' ? t('inv_production_in') : '', note: '', warehouseType: wt as WarehouseType, packageSpec: ps as PackageSpec });
    setShowStockModal({ type, styleNo, warehouseType: wt, packageSpec: ps });
  };

  const handleStockSubmit = async () => {
    if (!showStockModal) return;
    const { type, styleNo, warehouseType, packageSpec } = showStockModal;
    try {
      if (type === 'edit' && onUpdateStock) { await onUpdateStock(styleNo, stockForm.gradeA, stockForm.gradeB, warehouseType, packageSpec); toast.success(t('toast_stock_adjust_success')); }
      else if (type === 'production' && onProductionIn) { await onProductionIn(styleNo, stockForm.quantity, stockForm.grade, warehouseType, packageSpec, showStockModal.lineId, showStockModal.subLineId); }
      else if (type === 'in' && onStockIn) { await onStockIn(styleNo, stockForm.quantity, stockForm.grade, stockForm.source, stockForm.note, warehouseType, packageSpec); }
      else if (type === 'out' && onStockOut) { await onStockOut(styleNo, stockForm.quantity, stockForm.grade, stockForm.source, stockForm.note, warehouseType, packageSpec); }
      setShowStockModal(null);
    } catch { /* useData hook已处理错误提示 */ }
  };

  const handleOpenLockModal = (item: InventoryItem) => {
    setLockForm({ quantity: 0, reason: '' });
    setShowLockModal({ styleNo: item.styleNo, warehouseType: item.warehouseType, packageSpec: item.packageSpec, currentLocked: item.lockedForToday || 0, currentStock: item.currentStock });
  };

  const handleLockSubmit = async () => {
    if (!showLockModal || lockForm.quantity === 0) return;
    try {
      if (lockForm.quantity > 0 && onLockStock) await onLockStock(showLockModal.styleNo, lockForm.quantity, showLockModal.warehouseType, showLockModal.packageSpec, lockForm.reason);
      else if (lockForm.quantity < 0 && onUnlockStock) await onUnlockStock(showLockModal.styleNo, Math.abs(lockForm.quantity), showLockModal.warehouseType, showLockModal.packageSpec, lockForm.reason);
      setShowLockModal(null);
    } catch { /* hook已处理 */ }
  };

  const handleOpenSafetyModal = (item: InventoryItem) => {
    setSafetyStock(item.safetyStock || 0);
    setShowSafetyModal({ styleNo: item.styleNo, warehouseType: item.warehouseType, packageSpec: item.packageSpec, currentSafety: item.safetyStock || 0 });
  };

  const handleSafetySubmit = async () => {
    if (!showSafetyModal || !onSetSafetyStock) return;
    try {
      await onSetSafetyStock(showSafetyModal.styleNo, safetyStock, showSafetyModal.warehouseType, showSafetyModal.packageSpec);
      setShowSafetyModal(null);
    } catch { /* hook已处理 */ }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      exportInventoryToExcel(filteredInventory);
      toast.success(`${t('inv_export_success')}: ${filteredInventory.length}${t('inv_records')}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setExporting(false); }
  };

  const handleOpenAuditLogs = async (page = 1) => {
    setShowAuditModal(true);
    try {
      const res = await fetchInventoryAuditLogs({ page, pageSize: 20 });
      setAuditLogs(res.data);
      setAuditPage(res.page);
      setAuditTotal(res.totalPages);
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleShowHistory = async (styleNo: string, warehouseType?: string, packageSpec?: string) => {
    if (onGetTransactions) {
      const res = await onGetTransactions({ styleNo, warehouseType, packageSpec });
      setTransactions(res?.data || res || []);
    }
    setShowHistoryModal(styleNo);
  };

  const handleOpenProductionIn = (item: PendingItem) => {
    setStockForm({ ...stockForm, quantity: item.quantity, warehouseType: WarehouseType.GENERAL, packageSpec: PackageSpec.KG820 });
    setShowStockModal({ type: 'production', styleNo: item.styleNo, warehouseType: WarehouseType.GENERAL, packageSpec: PackageSpec.KG820, lineId: item.lineId, subLineId: item.subLineId, pendingQty: item.quantity });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 标签页切换 */}
      <div className="flex justify-end items-center">
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
          {hasPendingStockIn && <button onClick={() => setActiveTab('pending')} className={`px-2 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition ${activeTab === 'pending' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{isMobile ? '待入库' : t('inv_pending_in')}</button>}
          <button onClick={() => setActiveTab('inventory')} className={`px-2 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{isMobile ? '库存' : t('inv_title')}</button>
          <button onClick={() => setActiveTab('orders')} className={`px-2 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition ${activeTab === 'orders' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{isMobile ? '待装车' : t('wh_pending_load')}</button>
          <button onClick={() => setActiveTab('incidents')} className={`px-2 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition ${activeTab === 'incidents' ? 'bg-white dark:bg-slate-700 shadow text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>{isMobile ? '异常' : t('incident_log')}</button>
        </div>
      </div>

      {/* 待入库Tab / 库存管理Tab */}
      {(activeTab === 'pending' || activeTab === 'inventory') && (
        <InventorySection
          inventory={inventory}
          lines={activeTab === 'pending' ? lines : []}
          filteredInventory={activeTab === 'inventory' ? filteredInventory : []}
          filterWarehouse={filterWarehouse}
          filterPackage={filterPackage}
          filterStyleNo={filterStyleNo}
          exporting={exporting}
          onFilterWarehouseChange={setFilterWarehouse}
          onFilterPackageChange={setFilterPackage}
          onFilterStyleNoChange={setFilterStyleNo}
          onOpenStockModal={handleOpenStockModal}
          onShowHistory={handleShowHistory}
          onOpenLockModal={handleOpenLockModal}
          onOpenSafetyModal={handleOpenSafetyModal}
          onOpenAuditLogs={() => handleOpenAuditLogs()}
          onExport={handleExport}
          onOpenProductionIn={handleOpenProductionIn}
          onSetSafetyStock={onSetSafetyStock}
          onStockIn={!!onStockIn}
          onStockOut={!!onStockOut}
          onUpdateStock={!!onUpdateStock}
          onGetTransactions={!!onGetTransactions}
          onLockStock={!!onLockStock}
          onUnlockStock={!!onUnlockStock}
        />
      )}

      {/* 待装车Tab / 异常记录Tab */}
      {(activeTab === 'orders' || activeTab === 'incidents') && (
        <OrdersSection
          orders={orders}
          incidents={incidents}
          activeTab={activeTab}
          onConfirmLoad={onConfirmLoad}
          onOpenIncident={handleOpenIncident}
          onResolveIncident={onResolveIncident}
          onDeleteIncident={onDeleteIncident}
        />
      )}

      {/* 所有弹窗 */}
      <WarehouseModals
        inventory={inventory}
        showStockModal={showStockModal}
        stockForm={stockForm}
        showHistoryModal={showHistoryModal}
        transactions={transactions}
        showIncidentModal={showIncidentModal}
        selectedOrder={selectedOrder}
        incidentReason={incidentReason}
        incidentNote={incidentNote}
        showLockModal={showLockModal}
        lockForm={lockForm}
        showSafetyModal={showSafetyModal}
        safetyStock={safetyStock}
        showAuditModal={showAuditModal}
        auditLogs={auditLogs}
        auditPage={auditPage}
        auditTotal={auditTotal}
        onCloseStockModal={() => setShowStockModal(null)}
        onStockFormChange={setStockForm}
        onStockSubmit={handleStockSubmit}
        onCloseHistoryModal={() => setShowHistoryModal(null)}
        onCloseIncidentModal={() => setShowIncidentModal(false)}
        onIncidentReasonChange={setIncidentReason}
        onIncidentNoteChange={setIncidentNote}
        onSubmitIncident={handleSubmitIncident}
        onCloseLockModal={() => setShowLockModal(null)}
        onLockFormChange={setLockForm}
        onLockSubmit={handleLockSubmit}
        onCloseSafetyModal={() => setShowSafetyModal(null)}
        onSafetyStockChange={setSafetyStock}
        onSafetySubmit={handleSafetySubmit}
        onCloseAuditModal={() => setShowAuditModal(false)}
        onAuditPageChange={handleOpenAuditLogs}
      />
    </div>
  );
};

export default WarehouseView;
