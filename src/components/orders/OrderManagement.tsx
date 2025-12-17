import React, { useState, useMemo } from 'react';
import { Order, InventoryItem, ProductLine, LoadingTimeSlot, WorkshopCommStatus, TradeType, OrderStatus } from '../../types';
import { AlertCircle, Bot, Loader2, MessageSquare, ChevronDown, ChevronUp, Upload, FileSpreadsheet, Edit2, Trash2, Package, Truck, Calendar, Download, CheckSquare, Square, Printer } from 'lucide-react';
import { parseOrderText, patchOrder, createOrder, deleteOrder } from '../../services';
import { invalidateCache } from '../../services/api';
import { toast } from '../common/Toast';
import { useLanguage } from '../../i18n';
import { calculateFulfillment, exportOrdersToExcel } from '../../utils';
import { Modal } from '../common';
import * as XLSX from 'xlsx';
import OrderCalendar from './OrderCalendar';
import PrintPackingList from '../common/PrintPackingList';

interface OrderManagementProps {
  orders: Order[];
  inventory: InventoryItem[];
  lines: ProductLine[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  onAcknowledgeOrder: (id: string) => void;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ orders, inventory, lines, setOrders, onAcknowledgeOrder }) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parseInput, setParseInput] = useState('');
  const [showParseModal, setShowParseModal] = useState(false);
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workshopStatus, setWorkshopStatus] = useState<WorkshopCommStatus>(WorkshopCommStatus.NOT_STARTED);
  const [workshopNote, setWorkshopNote] = useState('');
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelInput, setExcelInput] = useState('');
  const [excelPreview, setExcelPreview] = useState<Partial<Order>[]>([]);
  const [importMode, setImportMode] = useState<'paste' | 'file'>('paste');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'ready' | 'shipped'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const { t } = useLanguage();

  // 筛选订单
  const allOrders = useMemo(() => orders.filter(o => o.status !== OrderStatus.SHIPPED), [orders]);
  const readyOrders = useMemo(() => orders.filter(o => o.status === OrderStatus.READY_TO_SHIP), [orders]);
  const shippedOrders = useMemo(() => orders.filter(o => o.status === OrderStatus.SHIPPED), [orders]);
  const displayOrders = activeTab === 'all' ? allOrders : activeTab === 'ready' ? readyOrders : shippedOrders;

  // 更新订单状态（满足率不足100%时禁止切换到齐料待发和已出货）
  const handleUpdateStatus = async (id: string, status: OrderStatus, percent: number) => {
    if ((status === OrderStatus.READY_TO_SHIP || status === OrderStatus.SHIPPED) && percent < 100) {
      toast.warning(t('alert_status_100'));
      return;
    }
    try {
      await patchOrder(id, { status });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      toast.success(t('toast_status_updated'));
    } catch (e) {
      toast.error(t('alert_status_fail'));
    }
  };

  // 获取状态显示
  const getStatusColor = (s: OrderStatus) => {
    switch (s) {
      case OrderStatus.IN_PRODUCTION: return 'bg-blue-100 text-blue-700';
      case OrderStatus.READY_TO_SHIP: return 'bg-green-100 text-green-700';
      case OrderStatus.SHIPPED: return 'bg-slate-100 text-slate-500';
      case OrderStatus.CONFIRMED: return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };
  const getStatusText = (s: OrderStatus) => {
    switch (s) {
      case OrderStatus.IN_PRODUCTION: return t('status_in_production');
      case OrderStatus.READY_TO_SHIP: return t('status_ready_to_ship');
      case OrderStatus.SHIPPED: return t('status_shipped');
      case OrderStatus.CONFIRMED: return t('ws_confirmed');
      default: return t('status_pending');
    }
  };

  const handleGeminiParse = async () => {
    if (!parseInput.trim()) return;
    setIsParsing(true);
    try {
      const parsedOrders = await parseOrderText(parseInput);
      // 保存到后端数据库
      for (const order of parsedOrders) {
        await createOrder(order as Order);
      }
      invalidateCache('orders'); // 清除缓存
      setOrders(prev => [...prev, ...parsedOrders as Order[]]);
      setParseInput('');
      setShowParseModal(false);
      toast.success(`成功导入 ${parsedOrders.length} 条订单`);
    } catch (e) { toast.error((e as Error).message || t('alert_parse_error')); }
    finally { setIsParsing(false); }
  };

  const handleOpenWorkshop = (order: Order) => {
    setSelectedOrder(order);
    setWorkshopStatus(order.workshopCommStatus || WorkshopCommStatus.NOT_STARTED);
    setWorkshopNote(order.workshopNote || '');
    setShowWorkshopModal(true);
  };

  const handleUpdateWorkshop = async () => {
    if (!selectedOrder) return;
    try {
      await patchOrder(selectedOrder.id, { workshopCommStatus: workshopStatus, workshopNote }); // 保存到后端
      invalidateCache('orders');
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, workshopCommStatus: workshopStatus, workshopNote } : o));
      setShowWorkshopModal(false);
      setSelectedOrder(null);
      toast.success('车间沟通状态已更新');
    } catch (e) { toast.error((e as Error).message); }
  };

  // Excel粘贴解析：日期 客户 款号 PI号 产线 提单号 总量 柜数 包/柜 港口 对接人 贸易类型 装货要求
  const parseExcelData = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const orders: Partial<Order>[] = [];
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 4) continue;
      const [date, client, styleNo, piNo, lineId, blNo, totalTons, containers, pkgPerCont, port, contact, tradeType, requirements] = cols;
      if (!client || !styleNo || !totalTons) continue;
      const tons = parseFloat(totalTons) || 0;
      orders.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: date || new Date().toISOString().split('T')[0],
        client: client.trim(),
        styleNo: styleNo.trim(),
        piNo: piNo?.trim() || '',
        lineId: lineId ? parseInt(lineId) : undefined,
        blNo: blNo?.trim() || '',
        totalTons: tons,
        containers: parseInt(containers) || 1,
        packagesPerContainer: parseInt(pkgPerCont) || 30,
        port: port?.trim() || '',
        contactPerson: contact?.trim() || '',
        tradeType: tradeType?.includes('保税') ? TradeType.BONDED : TradeType.GENERAL,
        requirements: requirements?.trim() || '',
        status: 'Pending' as any,
        isLargeOrder: tons > 100,
        largeOrderAck: false,
      });
    }
    return orders;
  };

  const handleExcelParse = () => {
    const parsed = parseExcelData(excelInput);
    setExcelPreview(parsed);
  };

  const handleExcelImport = async () => {
    if (excelPreview.length === 0) return;
    try {
      // 保存到后端数据库
      for (const order of excelPreview) {
        await createOrder(order as Order);
      }
      invalidateCache('orders'); // 清除缓存
      setOrders(prev => [...prev, ...excelPreview as Order[]]);
      toast.success(`成功导入 ${excelPreview.length} 条订单`);
      setExcelInput('');
      setExcelPreview([]);
      setShowExcelModal(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const orders: Partial<Order>[] = [];
      for (let i = 1; i < rows.length; i++) { // 跳过表头
        const cols = rows[i];
        if (!cols || cols.length < 4) continue;
        const [date, client, styleNo, piNo, lineId, blNo, totalTons, containers, pkgPerCont, port, contact, tradeType, requirements] = cols;
        if (!client || !styleNo) continue;
        const tons = parseFloat(totalTons) || 0;
        orders.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i,
          date: date ? String(date) : new Date().toISOString().split('T')[0],
          client: String(client).trim(),
          styleNo: String(styleNo).trim(),
          piNo: piNo ? String(piNo).trim() : '',
          lineId: lineId ? parseInt(String(lineId)) : undefined,
          blNo: blNo ? String(blNo).trim() : '',
          totalTons: tons,
          containers: parseInt(String(containers)) || 1,
          packagesPerContainer: parseInt(String(pkgPerCont)) || 30,
          port: port ? String(port).trim() : '',
          contactPerson: contact ? String(contact).trim() : '',
          tradeType: tradeType && String(tradeType).includes('保税') ? TradeType.BONDED : TradeType.GENERAL,
          requirements: requirements ? String(requirements).trim() : '',
          status: 'Pending' as any,
          isLargeOrder: tons > 100,
          largeOrderAck: false,
        });
      }
      setExcelPreview(orders);
    } catch (err) {
      alert(t('alert_excel_fail'));
    } finally {
      setIsLoadingFile(false);
      e.target.value = '';
    }
  };

  const handleOpenEdit = (order: Order) => {
    setEditingOrder({ ...order });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    const tons = editingOrder.totalTons;
    const updatedOrder = { ...editingOrder, isLargeOrder: tons > 100 };
    try {
      await patchOrder(editingOrder.id, updatedOrder);
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? updatedOrder : o));
      setShowEditModal(false);
      setEditingOrder(null);
      toast.success(t('toast_order_saved'));
    } catch (e) {
      toast.error(t('alert_save_fail'));
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm(t('alert_delete_confirm'))) return;
    try {
      await deleteOrder(id); // 使用静态导入的deleteOrder
      invalidateCache('orders');
      setOrders(prev => prev.filter(o => o.id !== id));
      toast.success('订单已删除');
    } catch (e) {
      toast.error((e as Error).message || t('alert_delete_fail'));
    }
  };

  const getWsColor = (s?: WorkshopCommStatus) => s === WorkshopCommStatus.CONFIRMED ? 'bg-green-100 text-green-700' : s === WorkshopCommStatus.IN_PROGRESS ? 'bg-yellow-100 text-yellow-700' : s === WorkshopCommStatus.ISSUE ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600';
  const getWsText = (s?: WorkshopCommStatus) => s === WorkshopCommStatus.CONFIRMED ? t('ws_confirmed') : s === WorkshopCommStatus.IN_PROGRESS ? t('ws_in_progress') : s === WorkshopCommStatus.ISSUE ? t('ws_issue') : t('ws_not_started');
  const getTimeText = (s?: LoadingTimeSlot) => s === LoadingTimeSlot.MORNING ? t('loading_morning') : s === LoadingTimeSlot.AFTERNOON ? t('loading_afternoon') : t('loading_flexible');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
          <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('view_table')}</button>
          <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}><Calendar size={14} className="mr-1" />{t('view_calendar')}</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewMode === 'table' && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
              <button onClick={() => setActiveTab('all')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}><Package size={14} className="mr-1" />{t('tab_pending')} <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-600 px-1.5 rounded">{allOrders.length}</span></button>
              <button onClick={() => setActiveTab('ready')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${activeTab === 'ready' ? 'bg-white dark:bg-slate-700 shadow text-green-600' : 'text-slate-600 dark:text-slate-400'}`}><Truck size={14} className="mr-1" />{t('tab_ready')} <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 rounded">{readyOrders.length}</span></button>
              <button onClick={() => setActiveTab('shipped')} className={`px-3 py-1.5 rounded text-sm font-medium transition flex items-center ${activeTab === 'shipped' ? 'bg-white dark:bg-slate-700 shadow text-slate-600' : 'text-slate-600 dark:text-slate-400'}`}>{t('tab_shipped')} <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-600 px-1.5 rounded">{shippedOrders.length}</span></button>
            </div>
          )}
          <button onClick={() => exportOrdersToExcel(displayOrders)} className="flex items-center px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition" title={t('btn_export')}><Download size={16} className="mr-1" />{t('btn_export')}</button>
          <button onClick={() => setShowExcelModal(true)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"><Upload size={18} className="mr-2" />{t('btn_import')}</button>
          <button onClick={() => setShowParseModal(true)} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"><Bot size={18} className="mr-2" />{t('btn_import_ai')}</button>
        </div>
      </div>

      {viewMode === 'calendar' && <OrderCalendar orders={orders} onSelectOrder={(o) => { setEditingOrder({ ...o }); setShowEditModal(true); }} onCreateOrder={(date) => { setEditingOrder({ id: '', date: new Date().toISOString().split('T')[0], client: '', styleNo: '', piNo: '', totalTons: 0, containers: 1, packagesPerContainer: 30, port: '', contactPerson: '', tradeType: TradeType.GENERAL, requirements: '', status: OrderStatus.PENDING, isLargeOrder: false, largeOrderAck: false, expectedShipDate: date } as Order); setShowEditModal(true); }} />}

      {printOrder && <PrintPackingList order={printOrder} inventory={inventory} onClose={() => setPrintOrder(null)} />}

      <Modal isOpen={showExcelModal} onClose={() => { setShowExcelModal(false); setExcelPreview([]); setImportMode('paste'); }} title={t('import_title')} titleIcon={<Upload size={20} />}>
        <div className="space-y-4">
          <div className="flex space-x-2 mb-2">
            <button onClick={() => setImportMode('paste')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${importMode === 'paste' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{t('paste_data')}</button>
            <button onClick={() => setImportMode('file')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${importMode === 'file' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{t('upload_file')}</button>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">{importMode === 'paste' ? t('paste_hint') : t('upload_hint')}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">{t('column_order')}</p>
          </div>
          {importMode === 'paste' ? (
            <>
              <textarea className="w-full h-32 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none" placeholder="从Excel粘贴数据..." value={excelInput} onChange={(e) => setExcelInput(e.target.value)} />
              <button onClick={handleExcelParse} disabled={!excelInput.trim()} className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">{t('parse_preview')}</button>
            </>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              {isLoadingFile ? <Loader2 className="animate-spin text-green-600 dark:text-green-400" size={32} /> : <><FileSpreadsheet size={32} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500 dark:text-slate-400">点击选择Excel文件 (.xlsx)</span></>}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
          {excelPreview.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">{t('preview_count')} ({excelPreview.length})</div>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"><tr><th className="px-2 py-1 text-left">日期</th><th className="px-2 py-1 text-left">客户</th><th className="px-2 py-1 text-left">款号</th><th className="px-2 py-1 text-right">吨数</th><th className="px-2 py-1 text-center">柜数</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {excelPreview.map((o, i) => <tr key={i}><td className="px-2 py-1">{o.date}</td><td className="px-2 py-1">{o.client}</td><td className="px-2 py-1 font-mono">{o.styleNo}</td><td className="px-2 py-1 text-right">{o.totalTons}</td><td className="px-2 py-1 text-center">{o.containers}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button onClick={handleExcelImport} disabled={excelPreview.length === 0} className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">{t('confirm_import')} {excelPreview.length > 0 && `(${excelPreview.length})`}</button>
        </div>
      </Modal>

      <Modal isOpen={showParseModal} onClose={() => setShowParseModal(false)} title={t('modal_title')}>
        <p className="text-sm text-slate-500 mb-4">{t('modal_desc')}</p>
        <textarea className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('modal_placeholder')} value={parseInput} onChange={(e) => setParseInput(e.target.value)} />
        <div className="flex justify-end space-x-3">
          <button onClick={() => setShowParseModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('btn_cancel')}</button>
          <button onClick={handleGeminiParse} disabled={isParsing || !parseInput} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
            {isParsing && <Loader2 className="animate-spin mr-2" size={16} />}{isParsing ? t('btn_analyzing') : t('btn_parse_add')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showWorkshopModal} onClose={() => setShowWorkshopModal(false)} title={t('workshop_status')} titleIcon={<MessageSquare size={20} />}>
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-sm">
              <p><span className="font-semibold">{t('table_client')}:</span> {selectedOrder.client}</p>
              <p><span className="font-semibold">{t('table_style')}:</span> {selectedOrder.styleNo}</p>
              <p><span className="font-semibold">{t('table_total')}:</span> {selectedOrder.totalTons} t</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('workshop_status')}</label>
              <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={workshopStatus} onChange={(e) => setWorkshopStatus(e.target.value as WorkshopCommStatus)}>
                <option value={WorkshopCommStatus.NOT_STARTED}>{t('ws_not_started')}</option>
                <option value={WorkshopCommStatus.IN_PROGRESS}>{t('ws_in_progress')}</option>
                <option value={WorkshopCommStatus.CONFIRMED}>{t('ws_confirmed')}</option>
                <option value={WorkshopCommStatus.ISSUE}>{t('ws_issue')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_notes')}</label>
              <textarea className="w-full border border-slate-300 rounded-lg p-3 text-sm h-20" value={workshopNote} onChange={(e) => setWorkshopNote(e.target.value)} />
            </div>
            <button onClick={handleUpdateWorkshop} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">{t('btn_update_workshop')}</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={t('edit_order')} titleIcon={<Edit2 size={20} />}>
        {editingOrder && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_date')}</label><input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.date} onChange={(e) => setEditingOrder({ ...editingOrder, date: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_client')} *</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.client} onChange={(e) => setEditingOrder({ ...editingOrder, client: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_style')} *</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.styleNo} onChange={(e) => setEditingOrder({ ...editingOrder, styleNo: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_pi')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.piNo} onChange={(e) => setEditingOrder({ ...editingOrder, piNo: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_tons')} *</label><input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.totalTons} onChange={(e) => setEditingOrder({ ...editingOrder, totalTons: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_containers')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.containers} onChange={(e) => setEditingOrder({ ...editingOrder, containers: parseInt(e.target.value) || 1 })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_pkg')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.packagesPerContainer} onChange={(e) => setEditingOrder({ ...editingOrder, packagesPerContainer: parseInt(e.target.value) || 30 })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_line')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.lineId || ''} onChange={(e) => setEditingOrder({ ...editingOrder, lineId: e.target.value ? parseInt(e.target.value) : undefined })}><option value="">-</option>{lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_bl')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.blNo || ''} onChange={(e) => setEditingOrder({ ...editingOrder, blNo: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_port')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.port} onChange={(e) => setEditingOrder({ ...editingOrder, port: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_contact')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.contactPerson} onChange={(e) => setEditingOrder({ ...editingOrder, contactPerson: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_trade_type')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.tradeType} onChange={(e) => setEditingOrder({ ...editingOrder, tradeType: e.target.value as TradeType })}><option value={TradeType.GENERAL}>{t('trade_general')}</option><option value={TradeType.BONDED}>{t('trade_bonded')}</option></select></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_loading_time')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.loadingTimeSlot || LoadingTimeSlot.FLEXIBLE} onChange={(e) => setEditingOrder({ ...editingOrder, loadingTimeSlot: e.target.value as LoadingTimeSlot })}><option value={LoadingTimeSlot.FLEXIBLE}>{t('loading_flexible')}</option><option value={LoadingTimeSlot.MORNING}>{t('loading_morning')}</option><option value={LoadingTimeSlot.AFTERNOON}>{t('loading_afternoon')}</option></select></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_ship_date')}</label><input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.expectedShipDate || ''} onChange={(e) => setEditingOrder({ ...editingOrder, expectedShipDate: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_prep_days')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.prepDaysRequired || 0} onChange={(e) => setEditingOrder({ ...editingOrder, prepDaysRequired: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_requirements')}</label><textarea className="w-full border border-slate-300 rounded-lg p-2 text-sm h-16" value={editingOrder.requirements} onChange={(e) => setEditingOrder({ ...editingOrder, requirements: e.target.value })} /></div>
            <button onClick={handleSaveEdit} disabled={!editingOrder.client || !editingOrder.styleNo} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">{t('btn_save')}</button>
          </div>
        )}
      </Modal>

      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left">{t('table_date')}</th>
                <th className="px-3 py-3 text-left">{t('table_client')}</th>
                <th className="px-3 py-3 text-left">{t('table_style')}</th>
                <th className="px-3 py-3 text-right">{t('table_total')}</th>
                <th className="px-3 py-3 text-center">{t('table_containers')}</th>
                <th className="px-3 py-3 text-left">{t('table_port')}</th>
                <th className="px-3 py-3 text-left">{t('workshop_status')}</th>
                <th className="px-3 py-3 text-left">{t('table_fulfillment')}</th>
                <th className="px-3 py-3 text-center">{t('table_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {displayOrders.map((order, idx) => {
                const { percent, isShortage } = calculateFulfillment(order, inventory, lines);
                const isUrgent = order.isLargeOrder && !order.largeOrderAck;
                const isExpanded = expandedId === order.id;
                return (
                  <React.Fragment key={order.id}>
                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer`} onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                      <td className="px-3 py-3 text-slate-400 dark:text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{order.date}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{order.client}</div>
                        {order.isLargeOrder && <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-1 rounded">{t('tag_large')}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                        {order.lineId && <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{order.lineId}{t('lines_suffix')}</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-medium text-slate-800 dark:text-slate-100">{order.totalTons.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">{order.containers}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{order.port}</td>
                      <td className="px-3 py-3">
                        <select value={order.status} onChange={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, e.target.value as OrderStatus, percent); }} onClick={(e) => e.stopPropagation()} className={`px-2 py-0.5 rounded text-xs border-none cursor-pointer ${getStatusColor(order.status)}`}>
                          <option value={OrderStatus.PENDING}>{t('status_pending')}</option>
                          <option value={OrderStatus.IN_PRODUCTION}>{t('status_in_production')}</option>
                          <option value={OrderStatus.READY_TO_SHIP} disabled={percent < 100}>{t('status_ready_to_ship')}</option>
                          <option value={OrderStatus.SHIPPED} disabled={percent < 100}>{t('status_shipped')}</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2"><div className={`h-2 rounded-full ${isShortage ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                          <span className={`text-xs ${isShortage ? 'text-red-500 font-bold' : 'text-green-600 dark:text-green-400'}`}>{percent.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {isUrgent && (
                            <button onClick={(e) => { e.stopPropagation(); onAcknowledgeOrder(order.id); }} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold animate-pulse inline-flex items-center"><AlertCircle size={10} className="mr-0.5" />{t('btn_ack_large')}</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setPrintOrder(order); }} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" title={t('print_packing_list')}><Printer size={14} /></button>
                          {order.status !== OrderStatus.SHIPPED && <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(order); }} className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><Edit2 size={14} /></button>}
                          {order.status !== OrderStatus.SHIPPED && <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
                          {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_po')}</span><span className="font-mono text-slate-700 dark:text-slate-300">{order.piNo}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_bl')}</span><span className="font-mono text-slate-700 dark:text-slate-300">{order.blNo || '-'}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_pkg_per_cont')}</span><span className="text-slate-700 dark:text-slate-300">{order.packagesPerContainer}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_contact')}</span><span className="bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs">{order.contactPerson}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_trade_type')}</span><span className={`px-2 py-0.5 rounded text-xs ${order.tradeType === TradeType.BONDED ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{order.tradeType === TradeType.BONDED ? t('trade_bonded') : t('trade_general')}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('loading_time')}</span><span className="text-slate-700 dark:text-slate-300">{getTimeText(order.loadingTimeSlot)}</span></div>
                            <div className="col-span-2 md:col-span-4 lg:col-span-6"><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_requirements')}</span><span className="text-slate-700 dark:text-slate-300">{order.requirements}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-600">
              <tr>
                <td className="px-3 py-3 text-slate-500 dark:text-slate-400 font-medium" colSpan={4}>{t('total_summary')} ({displayOrders.length} {t('order_unit')})</td>
                <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{displayOrders.reduce((sum, o) => sum + o.totalTons, 0).toFixed(2)}</td>
                <td className="px-3 py-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300">{displayOrders.reduce((sum, o) => sum + o.containers, 0)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
