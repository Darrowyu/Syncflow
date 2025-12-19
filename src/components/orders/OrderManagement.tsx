import React, { useState, useMemo, useCallback } from 'react';
import { Order, InventoryItem, ProductLine, LoadingTimeSlot, WorkshopCommStatus, TradeType, OrderStatus, PackageSpec, WarehouseAllocation } from '../../types';
import { AlertCircle, Bot, Loader2, MessageSquare, ChevronDown, ChevronUp, Upload, FileSpreadsheet, Edit2, Trash2, Package, Truck, Calendar, Download, Printer, ArrowUp, ArrowDown, Users, Filter, X, Search, Lock, CheckCircle } from 'lucide-react';
import { useIsMobile } from '../../hooks';
import { parseOrderText, patchOrder, createOrder, deleteOrder } from '../../services';
import { invalidateCache } from '../../services/api';
import { toast } from '../common/Toast';
import { useLanguage } from '../../i18n';
import { calculateFulfillment, exportOrdersToExcel } from '../../utils';
import { Modal } from '../common';
import ExcelJS from 'exceljs';
import OrderCalendar from './OrderCalendar';
import PrintPackingList from '../common/PrintPackingList';
import CustomerManagement from './CustomerManagement';

interface FulfillmentPopoverProps { order: Order; inventory: InventoryItem[]; lines: ProductLine[]; t: (k: string) => string; onClose: () => void; onSave: (alloc: WarehouseAllocation) => void; }
const FulfillmentPopover: React.FC<FulfillmentPopoverProps> = ({ order, inventory, lines, t, onClose, onSave }) => {
  // 解析订单产线ID
  const orderLineIds = useMemo(() => {
    if (order.lineIds) return order.lineIds.split(/[\/,]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (order.lineId) return [order.lineId];
    return [];
  }, [order.lineIds, order.lineId]);
  // 按产线筛选库存
  const filterByLine = (items: InventoryItem[]): InventoryItem[] => {
    if (orderLineIds.length === 0) return items;
    return items.filter(i => i.lineId && orderLineIds.includes(i.lineId));
  };
  // 判断订单需求仓库类型
  const isBonded = order.tradeType === TradeType.BONDED;
  const hasCustomAlloc = !!order.warehouseAllocation; // 是否有自定义分配
  const needGeneral = hasCustomAlloc || !isBonded; // 需要显示一般贸易库
  const needBonded = hasCustomAlloc || isBonded; // 需要显示保税库
  // 筛选库存
  const generalItems = needGeneral ? filterByLine(inventory.filter(i => i.styleNo === order.styleNo && i.warehouseType === 'general')) : [];
  const bondedItems = needBonded ? filterByLine(inventory.filter(i => i.styleNo === order.styleNo && i.warehouseType === 'bonded')) : [];
  const generalStock = generalItems.reduce((sum, i) => sum + i.currentStock, 0);
  const bondedStock = bondedItems.reduce((sum, i) => sum + i.currentStock, 0);
  // 初始分配：按贸易类型默认
  const initAlloc = order.warehouseAllocation || { general: isBonded ? 0 : order.totalTons, bonded: isBonded ? order.totalTons : 0 };
  const [alloc, setAlloc] = useState<WarehouseAllocation>(initAlloc);
  const [showBothWh, setShowBothWh] = useState(hasCustomAlloc); // 是否显示双仓分配
  const totalAlloc = alloc.general + alloc.bonded;
  const isValid = Math.abs(totalAlloc - order.totalTons) < 0.01;
  const canFulfill = alloc.general <= generalStock && alloc.bonded <= bondedStock;
  // 切换到双仓分配模式
  const enableBothWh = () => { setShowBothWh(true); setAlloc({ general: 0, bonded: 0 }); };
  return (
    <div className="absolute z-50 top-full right-0 mt-1 w-80 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-xs space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
        <span className="font-medium text-slate-700 dark:text-slate-200">{order.styleNo} {order.packageSpec && `(${order.packageSpec})`}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isBonded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>{isBonded ? t('wh_bonded') : t('wh_general')}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
      </div>
      <div className="flex justify-between"><span className="text-slate-500">{t('order_demand')}:</span><span className="font-mono font-medium">{order.totalTons}t</span></div>
      <div className="border-t border-slate-100 dark:border-slate-700 pt-2 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">{t('wh_allocation')}:</span>
          {!showBothWh && <button onClick={enableBothWh} className="text-[10px] text-blue-500 hover:underline">{t('split_warehouse')}</button>}
        </div>
        {showBothWh ? (<>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" />{t('wh_general')}</span>
            <span className="text-slate-400 text-[10px]">{t('available_stock')}: {generalStock.toFixed(1)}t</span>
            <input type="number" step="0.1" min="0" value={alloc.general} onChange={(e) => setAlloc({ ...alloc, general: parseFloat(e.target.value) || 0 })} className={`w-20 px-1.5 py-0.5 border rounded text-right font-mono ${alloc.general > generalStock ? 'border-red-400 bg-red-50' : 'border-slate-300 dark:border-slate-600 dark:bg-slate-700'}`} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />{t('wh_bonded')}</span>
            <span className="text-slate-400 text-[10px]">{t('available_stock')}: {bondedStock.toFixed(1)}t</span>
            <input type="number" step="0.1" min="0" value={alloc.bonded} onChange={(e) => setAlloc({ ...alloc, bonded: parseFloat(e.target.value) || 0 })} className={`w-20 px-1.5 py-0.5 border rounded text-right font-mono ${alloc.bonded > bondedStock ? 'border-red-400 bg-red-50' : 'border-slate-300 dark:border-slate-600 dark:bg-slate-700'}`} />
          </div>
        </>) : (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${isBonded ? 'bg-blue-500' : 'bg-slate-500'}`} />{isBonded ? t('wh_bonded') : t('wh_general')}</span>
            <span className="text-slate-400 text-[10px]">{t('available_stock')}: {(isBonded ? bondedStock : generalStock).toFixed(1)}t</span>
            <span className="font-mono font-medium">{order.totalTons}t</span>
          </div>
        )}
        <div className={`flex justify-between pt-1 border-t border-dashed ${isValid ? 'text-green-600' : 'text-red-500'}`}>
          <span>{t('total_alloc')}:</span><span className="font-mono font-bold">{totalAlloc.toFixed(2)}t {!isValid && <span className="text-red-500">({t('still_need')} {(order.totalTons - totalAlloc).toFixed(2)}t)</span>}</span>
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 pt-2 space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">{t('stock_detail')}:</span>
          {orderLineIds.length > 0 && <span className="text-[10px] text-blue-500">{t('line_filter')}: {orderLineIds.map(id => lines.find(l => l.id === id)?.name || `#${id}`).join('/')}</span>}
        </div>
        {generalItems.length > 0 && <div className="pl-2">{generalItems.map(item => <div key={`${item.styleNo}-${item.warehouseType}-${item.packageSpec}-${item.lineId}`} className="flex justify-between text-slate-500"><span>{t('wh_general')} {item.packageSpec} {item.lineName && <span className="text-blue-400">({item.lineName})</span>}</span><span className="font-mono">{item.currentStock.toFixed(1)}t</span></div>)}</div>}
        {bondedItems.length > 0 && <div className="pl-2">{bondedItems.map(item => <div key={`${item.styleNo}-${item.warehouseType}-${item.packageSpec}-${item.lineId}`} className="flex justify-between text-slate-500"><span>{t('wh_bonded')} {item.packageSpec} {item.lineName && <span className="text-blue-400">({item.lineName})</span>}</span><span className="font-mono">{item.currentStock.toFixed(1)}t</span></div>)}</div>}
        {generalItems.length === 0 && bondedItems.length === 0 && <div className="text-slate-400 italic pl-2">{t('no_stock')}</div>}
      </div>
      {showBothWh && <button onClick={() => onSave(alloc)} disabled={!isValid || !canFulfill} className="w-full py-1.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{t('btn_save_alloc')}</button>}
    </div>
  );
};

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
  const [isDragging, setIsDragging] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isCreating, setIsCreating] = useState(false); // 新建订单模式
  const [activeTab, setActiveTab] = useState<'all' | 'ready' | 'shipped'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'customers'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [sortConfig, setSortConfig] = useState<{ field: keyof Order, dir: 'asc' | 'desc' }[]>([]); // 多列排序
  const [fulfillmentDetailId, setFulfillmentDetailId] = useState<string | null>(null); // 满足率详情展开
  const [showFilters, setShowFilters] = useState(false); // 高级筛选面板
  const [filters, setFilters] = useState<{
    dateFrom: string;
    dateTo: string;
    client: string;
    styleNo: string;
    port: string;
    status: string;
    tradeType: string;
    contactPerson: string;
  }>({
    dateFrom: '',
    dateTo: '',
    client: '',
    styleNo: '',
    port: '',
    status: '',
    tradeType: '',
    contactPerson: '',
  });
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  // 筛选订单
  const allOrders = useMemo(() => orders.filter(o => o.status !== OrderStatus.SHIPPED), [orders]);
  const readyOrders = useMemo(() => orders.filter(o => o.status === OrderStatus.READY_TO_SHIP), [orders]);
  const shippedOrders = useMemo(() => orders.filter(o => o.status === OrderStatus.SHIPPED), [orders]);
  const filteredOrders = activeTab === 'all' ? allOrders : activeTab === 'ready' ? readyOrders : shippedOrders;

  // 高级筛选 + 多列排序
  const displayOrders = useMemo(() => {
    let result = filteredOrders;
    // 应用高级筛选
    if (filters.dateFrom) result = result.filter(o => o.date >= filters.dateFrom);
    if (filters.dateTo) result = result.filter(o => o.date <= filters.dateTo);
    if (filters.client) result = result.filter(o => o.client.toLowerCase().includes(filters.client.toLowerCase()));
    if (filters.styleNo) result = result.filter(o => o.styleNo.toLowerCase().includes(filters.styleNo.toLowerCase()));
    if (filters.port) result = result.filter(o => o.port.toLowerCase().includes(filters.port.toLowerCase()));
    if (filters.status) result = result.filter(o => o.status === filters.status);
    if (filters.tradeType) result = result.filter(o => o.tradeType === filters.tradeType);
    if (filters.contactPerson) result = result.filter(o => o.contactPerson.toLowerCase().includes(filters.contactPerson.toLowerCase()));
    // 应用排序
    if (sortConfig.length > 0) {
      result = [...result].sort((a, b) => {
        for (const { field, dir } of sortConfig) {
          const av = a[field], bv = b[field];
          const cmp = typeof av === 'number' ? av - (bv as number) : String(av ?? '').localeCompare(String(bv ?? ''));
          if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }
    return result;
  }, [filteredOrders, sortConfig, filters]);

  // 判断是否有筛选条件激活
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== '');
  }, [filters]);

  // 清除所有筛选
  const clearFilters = useCallback(() => {
    setFilters({ dateFrom: '', dateTo: '', client: '', styleNo: '', port: '', status: '', tradeType: '', contactPerson: '' });
  }, []);

  // 获取唯一值列表（用于下拉选项）
  const uniqueClients = useMemo(() => [...new Set(orders.map(o => o.client))].sort(), [orders]);
  const uniquePorts = useMemo(() => [...new Set(orders.map(o => o.port).filter(Boolean))].sort(), [orders]);
  const uniqueContacts = useMemo(() => [...new Set(orders.map(o => o.contactPerson).filter(Boolean))].sort(), [orders]);

  // 排序切换：点击添加/切换，Shift+点击多列排序
  const handleSort = useCallback((field: keyof Order, e: React.MouseEvent) => {
    setSortConfig(prev => {
      const idx = prev.findIndex(s => s.field === field);
      if (e.shiftKey) { // Shift+点击：多列排序
        if (idx >= 0) { // 已存在则切换方向或移除
          const cur = prev[idx];
          return cur.dir === 'asc' ? prev.map((s, i) => i === idx ? { ...s, dir: 'desc' } : s) : prev.filter((_, i) => i !== idx);
        }
        return [...prev, { field, dir: 'asc' }];
      }
      // 普通点击：单列排序
      if (idx >= 0 && prev.length === 1) return prev[0].dir === 'asc' ? [{ field, dir: 'desc' }] : [];
      return [{ field, dir: 'asc' }];
    });
  }, []);

  // 获取排序图标
  const getSortIcon = (field: keyof Order) => {
    const idx = sortConfig.findIndex(s => s.field === field);
    if (idx < 0) return null;
    const { dir } = sortConfig[idx];
    return <span className="inline-flex items-center ml-1">{dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{sortConfig.length > 1 && <span className="text-[10px] ml-0.5">{idx + 1}</span>}</span>;
  };

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
      case OrderStatus.CONFIRMED: return 'bg-blue-100 text-blue-700';
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

  // Excel粘贴解析：序号 日期 客户 款号 PI号 产线 提单号 总量 柜数 包/柜 港口 对接人 贸易类型 装货要求
  const parseExcelData = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const orders: Partial<Order>[] = [];
    const parseDate = (d: string): string => { // 日期格式转换：12/17 -> 2025-12-17
      if (!d) return new Date().toISOString().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // 已是标准格式
      const parts = d.split('/');
      if (parts.length === 2) return `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      return new Date().toISOString().split('T')[0];
    };
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 5) continue;
      const hasSeqNo = /^\d+$/.test(cols[0]?.trim()); // 检测第一列是否为序号
      const offset = hasSeqNo ? 1 : 0;
      const [date, client, styleNo, piNo, lineId, blNo, totalTons, containers, pkgPerCont, port, contact, tradeType, requirements] = cols.slice(offset);
      if (!client || !styleNo || !totalTons) continue;
      const tons = parseFloat(totalTons) || 0;
      orders.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: parseDate(date?.trim()),
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
        status: OrderStatus.PENDING,
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
    } catch (e) { toast.error((e as Error).message || '导入失败'); }
  };

  const processExcelFile = async (file: File) => {
    setIsLoadingFile(true);
    setIsDragging(false);
    const parseExcelDate = (d: unknown): string => { // Excel日期转换
      if (!d) return new Date().toISOString().split('T')[0];
      if (typeof d === 'number') { // Excel序列号日期
        const date = new Date((d - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
      }
      const s = String(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const parts = s.split('/');
      if (parts.length === 2) return `${new Date().getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      return new Date().toISOString().split('T')[0];
    };
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      const rows: unknown[][] = [];
      sheet.eachRow((row) => rows.push(row.values as unknown[]));
      const orders: Partial<Order>[] = [];
      const last: Record<string, unknown> = {}; // 记录上一行各列的值，处理合并单元格
      const getVal = (v: unknown, key: string): unknown => { // 获取值，空则用上一行
        if (v !== undefined && v !== null && v !== '') { last[key] = v; return v; }
        return last[key];
      };
      const toStr = (v: unknown): string => (v !== undefined && v !== null) ? String(v).trim() : '';
      const toNum = (v: unknown, def = 0): number => { const n = parseFloat(String(v)); return isNaN(n) ? def : n; };
      const toInt = (v: unknown, def = 0): number => { const n = parseInt(String(v), 10); return isNaN(n) ? def : n; };
      for (let i = 2; i < rows.length; i++) { // 跳过表头(exceljs索引从1开始，第1行是表头)
        const c = rows[i] as unknown[];
        if (!c || c.length < 5) continue;
        // exceljs的row.values索引从1开始：[1]序号 [2]日期 [3]客户 [4]款号 [5]PI号 [6]产线 [7]提单号 [8]总量 [9]柜数 [10]包/柜 [11]港口 [12]对接人 [13]贸易类型 [14]装货要求
        const styleNo = toStr(c[4]);
        if (!styleNo) continue;
        const tons = toNum(getVal(c[8], 'tons'));
        const lineVal = toStr(c[6]);
        const isMultiLine = lineVal && /[\/,]/.test(lineVal);
        orders.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i,
          date: parseExcelDate(getVal(c[2], 'date')),
          client: toStr(getVal(c[3], 'client')),
          styleNo,
          piNo: toStr(c[5]),
          lineId: isMultiLine ? undefined : (lineVal ? toInt(lineVal) : undefined),
          lineIds: isMultiLine ? lineVal : undefined,
          blNo: toStr(c[7]),
          totalTons: tons,
          containers: toInt(getVal(c[9], 'containers'), 1),
          packagesPerContainer: toInt(getVal(c[10], 'pkg'), 30),
          port: toStr(getVal(c[11], 'port')),
          contactPerson: toStr(getVal(c[12], 'contact')),
          tradeType: toStr(getVal(c[13], 'trade')).includes('保税') ? TradeType.BONDED : TradeType.GENERAL,
          requirements: toStr(c[14]),
          status: OrderStatus.PENDING,
          isLargeOrder: tons > 100,
          largeOrderAck: false,
        });
      }
      setExcelPreview(orders);
    } catch (err) {
      toast.error(t('alert_excel_fail'));
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processExcelFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(xlsx|xls)$/i.test(file.name)) processExcelFile(file);
    else toast.error(t('alert_excel_fail'));
  };

  const handleOpenEdit = (order: Order) => {
    setEditingOrder({ ...order });
    setIsCreating(false);
    setShowEditModal(true);
  };

  const handleOpenCreate = () => { // 新建订单
    setEditingOrder({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString().split('T')[0],
      client: '', styleNo: '', piNo: '', blNo: '', totalTons: 0, containers: 1, packagesPerContainer: 30,
      port: '', contactPerson: '', tradeType: TradeType.GENERAL, requirements: '',
      status: OrderStatus.PENDING, isLargeOrder: false, largeOrderAck: false,
      loadingTimeSlot: LoadingTimeSlot.FLEXIBLE, prepDaysRequired: 0
    });
    setIsCreating(true);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    const tons = editingOrder.totalTons;
    const updatedOrder = { ...editingOrder, isLargeOrder: tons > 100 };
    try {
      if (isCreating) { // 新建
        await createOrder(updatedOrder as Order);
        invalidateCache('orders');
        setOrders(prev => [...prev, updatedOrder as Order]);
        toast.success(t('toast_order_saved'));
      } else { // 编辑
        await patchOrder(editingOrder.id, updatedOrder);
        setOrders(prev => prev.map(o => o.id === editingOrder.id ? updatedOrder : o));
        toast.success(t('toast_order_saved'));
      }
      setShowEditModal(false);
      setEditingOrder(null);
      setIsCreating(false);
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
    <div className="space-y-4 md:space-y-6">
      {/* 工具栏 - 两行自适应布局 */}
      <div className="flex flex-col gap-2">
        {/* 第一行：视图切换 + Tab切换 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex flex-shrink-0">
            <button onClick={() => setViewMode('table')} className={`px-2 md:px-3 py-1.5 rounded text-xs md:text-sm font-medium transition ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('view_table')}</button>
            <button onClick={() => setViewMode('calendar')} className={`px-2 md:px-3 py-1.5 rounded text-xs md:text-sm font-medium transition flex items-center ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}><Calendar size={14} className="mr-1" />{isMobile ? '' : t('view_calendar')}</button>
            <button onClick={() => setViewMode('customers')} className={`px-2 md:px-3 py-1.5 rounded text-xs md:text-sm font-medium transition flex items-center ${viewMode === 'customers' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}><Users size={14} className="mr-1" />{isMobile ? '' : t('customer_management')}</button>
          </div>
          {viewMode === 'table' && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex flex-shrink-0">
              <button onClick={() => setActiveTab('all')} className={`px-2 md:px-3 py-1.5 rounded text-xs md:text-sm font-medium transition flex items-center ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{isMobile ? '' : <Package size={14} className="mr-1" />}{t('tab_pending')} <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-600 px-1 rounded">{allOrders.length}</span></button>
              <button onClick={() => setActiveTab('ready')} className={`px-2 md:px-3 py-1.5 rounded text-xs md:text-sm font-medium transition flex items-center ${activeTab === 'ready' ? 'bg-white dark:bg-slate-700 shadow text-green-600' : 'text-slate-600 dark:text-slate-400'}`}>{isMobile ? '' : <Truck size={14} className="mr-1" />}{t('tab_ready')} <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">{readyOrders.length}</span></button>
              <button onClick={() => setActiveTab('shipped')} className={`px-2 md:px-3 py-1.5 rounded text-xs md:text-sm font-medium transition flex items-center ${activeTab === 'shipped' ? 'bg-white dark:bg-slate-700 shadow text-slate-600' : 'text-slate-600 dark:text-slate-400'}`}>{t('tab_shipped')} <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-600 px-1 rounded">{shippedOrders.length}</span></button>
            </div>
          )}
        </div>
        {/* 第二行：筛选 + 导出 + 操作按钮 */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'table' && (
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center px-3 py-2 border rounded-lg transition text-sm ${hasActiveFilters ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <Filter size={16} className="mr-1" />
              {t('advanced_filter')}
              {hasActiveFilters && <span className="ml-1.5 w-2 h-2 bg-blue-500 rounded-full"></span>}
            </button>
          )}
          {!isMobile && <button onClick={() => exportOrdersToExcel(displayOrders)} className="flex items-center px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm" title={t('btn_export')}><Download size={16} className="mr-1" />{t('btn_export')}{hasActiveFilters && <span className="ml-1 text-xs text-blue-500">({displayOrders.length})</span>}</button>}
          <div className="flex-1" /> {/* 弹性占位 */}
          <button onClick={handleOpenCreate} className="flex items-center px-3 md:px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"><Package size={16} className="mr-1 md:mr-2" />{isMobile ? '+' : t('btn_add_order')}</button>
          <button onClick={() => setShowExcelModal(true)} className="flex items-center px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"><Upload size={16} className="mr-1 md:mr-2" />{isMobile ? '' : t('btn_import')}</button>
          <button onClick={() => setShowParseModal(true)} className="flex items-center px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"><Bot size={16} className="mr-1 md:mr-2" />{isMobile ? 'AI' : t('btn_import_ai')}</button>
        </div>
      </div>

      {/* 高级筛选面板 */}
      {viewMode === 'table' && showFilters && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Filter size={16} className="text-blue-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200">{t('filter_panel_title')}</span>
              {hasActiveFilters && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  {displayOrders.length} {t('filter_results')}
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center text-xs text-red-500 hover:text-red-600 transition">
                <X size={14} className="mr-1" />{t('clear_filters')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* 日期范围 */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_date_from')}</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_date_to')}</label>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            {/* 客户 */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_client')}</label>
              <select value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">{t('filter_all')}</option>
                {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* 款号 */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_style')}</label>
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={filters.styleNo} onChange={(e) => setFilters({ ...filters, styleNo: e.target.value })} placeholder="..." className="w-full pl-7 pr-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            {/* 港口 */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_port')}</label>
              <select value={filters.port} onChange={(e) => setFilters({ ...filters, port: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">{t('filter_all')}</option>
                {uniquePorts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {/* 状态 */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_status')}</label>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">{t('filter_all')}</option>
                <option value={OrderStatus.PENDING}>{t('status_pending')}</option>
                <option value={OrderStatus.IN_PRODUCTION}>{t('status_in_production')}</option>
                <option value={OrderStatus.READY_TO_SHIP}>{t('status_ready_to_ship')}</option>
                <option value={OrderStatus.SHIPPED}>{t('status_shipped')}</option>
              </select>
            </div>
            {/* 贸易类型 */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_trade_type')}</label>
              <select value={filters.tradeType} onChange={(e) => setFilters({ ...filters, tradeType: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">{t('filter_all')}</option>
                <option value={TradeType.GENERAL}>{t('trade_general')}</option>
                <option value={TradeType.BONDED}>{t('trade_bonded')}</option>
              </select>
            </div>
            {/* 对接人 */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('filter_contact')}</label>
              <select value={filters.contactPerson} onChange={(e) => setFilters({ ...filters, contactPerson: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">{t('filter_all')}</option>
                {uniqueContacts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'calendar' && <OrderCalendar orders={orders} onSelectOrder={(o) => { setEditingOrder({ ...o }); setShowEditModal(true); }} onCreateOrder={(date) => { setEditingOrder({ id: '', date, client: '', styleNo: '', piNo: '', totalTons: 0, containers: 1, packagesPerContainer: 30, port: '', contactPerson: '', tradeType: TradeType.GENERAL, requirements: '', status: OrderStatus.PENDING, isLargeOrder: false, largeOrderAck: false } as Order); setShowEditModal(true); }} />}

      {viewMode === 'customers' && <CustomerManagement orders={orders} />}

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
            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition ${isDragging ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
              {isLoadingFile ? <Loader2 className="animate-spin text-green-600 dark:text-green-400" size={32} /> : <><FileSpreadsheet size={32} className={isDragging ? 'text-green-500' : 'text-slate-400'} /><span className={`text-sm mt-2 ${isDragging ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>{isDragging ? t('drop_file_here') : t('drag_or_click')}</span></>}
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
            <button onClick={handleUpdateWorkshop} className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">{t('btn_update_workshop')}</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setIsCreating(false); }} title={isCreating ? t('create_order') : t('edit_order')} titleIcon={isCreating ? <Package size={20} /> : <Edit2 size={20} />}>
        {editingOrder && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_date')}</label><input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.date} onChange={(e) => setEditingOrder({ ...editingOrder, date: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_client')} *</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.client} onChange={(e) => setEditingOrder({ ...editingOrder, client: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_style')} *</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.styleNo} onChange={(e) => setEditingOrder({ ...editingOrder, styleNo: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_spec')} *</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.packageSpec || ''} onChange={(e) => setEditingOrder({ ...editingOrder, packageSpec: e.target.value as PackageSpec })}><option value="">-</option><option value={PackageSpec.KG820}>820kg</option><option value={PackageSpec.KG750}>750kg</option><option value={PackageSpec.KG25}>25kg</option></select></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_pi')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.piNo} onChange={(e) => setEditingOrder({ ...editingOrder, piNo: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_tons')} *</label><input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.totalTons} onChange={(e) => setEditingOrder({ ...editingOrder, totalTons: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_containers')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.containers} onChange={(e) => setEditingOrder({ ...editingOrder, containers: parseInt(e.target.value) || 1 })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_pkg')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.packagesPerContainer} onChange={(e) => setEditingOrder({ ...editingOrder, packagesPerContainer: parseInt(e.target.value) || 30 })} /></div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('field_line')}</label>
                <div className="flex flex-wrap gap-2 p-2 border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-700 max-h-24 overflow-y-auto">
                  {lines.map(l => {
                    const selectedIds = editingOrder.lineIds ? editingOrder.lineIds.split(/[\/,]/).map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : (editingOrder.lineId ? [editingOrder.lineId] : []);
                    const isChecked = selectedIds.includes(l.id);
                    return (
                      <label key={l.id} className={`flex items-center px-2 py-1 rounded cursor-pointer text-sm ${isChecked ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                        <input type="checkbox" className="mr-1.5" checked={isChecked} onChange={(e) => {
                          let newIds = [...selectedIds];
                          if (e.target.checked) newIds.push(l.id);
                          else newIds = newIds.filter(id => id !== l.id);
                          newIds.sort((a, b) => a - b);
                          if (newIds.length === 0) setEditingOrder({ ...editingOrder, lineId: undefined, lineIds: undefined });
                          else if (newIds.length === 1) setEditingOrder({ ...editingOrder, lineId: newIds[0], lineIds: undefined });
                          else setEditingOrder({ ...editingOrder, lineId: undefined, lineIds: newIds.join('/') });
                        }} />
                        {l.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_bl')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.blNo || ''} onChange={(e) => setEditingOrder({ ...editingOrder, blNo: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_port')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.port} onChange={(e) => setEditingOrder({ ...editingOrder, port: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_contact')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.contactPerson} onChange={(e) => setEditingOrder({ ...editingOrder, contactPerson: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_trade_type')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.tradeType} onChange={(e) => setEditingOrder({ ...editingOrder, tradeType: e.target.value as TradeType })}><option value={TradeType.GENERAL}>{t('trade_general')}</option><option value={TradeType.BONDED}>{t('trade_bonded')}</option></select></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_loading_time')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.loadingTimeSlot || LoadingTimeSlot.FLEXIBLE} onChange={(e) => setEditingOrder({ ...editingOrder, loadingTimeSlot: e.target.value as LoadingTimeSlot })}><option value={LoadingTimeSlot.FLEXIBLE}>{t('loading_flexible')}</option><option value={LoadingTimeSlot.MORNING}>{t('loading_morning')}</option><option value={LoadingTimeSlot.AFTERNOON}>{t('loading_afternoon')}</option></select></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_prep_days')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editingOrder.prepDaysRequired || 0} onChange={(e) => setEditingOrder({ ...editingOrder, prepDaysRequired: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_requirements')}</label><textarea className="w-full border border-slate-300 rounded-lg p-2 text-sm h-16" value={editingOrder.requirements} onChange={(e) => setEditingOrder({ ...editingOrder, requirements: e.target.value })} /></div>
            <button onClick={handleSaveEdit} disabled={!editingOrder.client || !editingOrder.styleNo || !editingOrder.packageSpec} className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">{t('btn_save')}</button>
          </div>
        )}
      </Modal>

      {/* 移动端卡片视图 */}
      {viewMode === 'table' && isMobile && (
        <div className="space-y-3">
          {displayOrders.length === 0 && <div className="text-center py-8 text-slate-400">{t('no_orders_load')}</div>}
          {displayOrders.map((order) => {
            const isReadyToShip = order.status === OrderStatus.READY_TO_SHIP;
            const isShipped = order.status === OrderStatus.SHIPPED;
            const { percent, isShortage } = calculateFulfillment(order, inventory, lines, orders);
            return (
              <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3" onClick={() => handleOpenEdit(order)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{order.client}</span>
                      {order.isLargeOrder && <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-1 rounded">{t('tag_large')}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                      <span className="text-xs text-slate-500">{order.date}</span>
                    </div>
                  </div>
                  <select value={order.status} onChange={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, e.target.value as OrderStatus, percent); }} onClick={(e) => e.stopPropagation()} className={`px-2 py-1 rounded text-xs border-none ${getStatusColor(order.status)}`}>
                    <option value={OrderStatus.PENDING}>{t('status_pending')}</option>
                    <option value={OrderStatus.IN_PRODUCTION}>{t('status_in_production')}</option>
                    <option value={OrderStatus.READY_TO_SHIP} disabled={percent < 100}>{t('status_ready_to_ship')}</option>
                    <option value={OrderStatus.SHIPPED} disabled={percent < 100}>{t('status_shipped')}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <span className="font-mono font-medium">{order.totalTons}t</span>
                    <span>{order.containers}柜</span>
                    <span className="text-xs text-slate-400">{order.port}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isShipped ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : isReadyToShip ? (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded flex items-center">
                        <Lock size={10} className="mr-0.5" />{t('status_locked')}
                      </span>
                    ) : (
                      <>
                        <div className="w-12 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${isShortage ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                        <span className={`text-xs ${isShortage ? 'text-red-500' : 'text-green-600'}`}>{percent.toFixed(0)}%</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  {order.isLargeOrder && !order.largeOrderAck ? (
                    <button onClick={(e) => { e.stopPropagation(); onAcknowledgeOrder(order.id); }} className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold animate-pulse flex items-center"><AlertCircle size={12} className="mr-1" />{t('btn_ack_large')}</button>
                  ) : <span />}
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setPrintOrder(order); }} className="p-1.5 text-slate-400 hover:text-blue-600"><Printer size={16} /></button>
                    {order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.READY_TO_SHIP && <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
          {/* 移动端合计 */}
          <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 text-sm flex justify-between">
            <span className="text-slate-500">{t('total_summary')} ({displayOrders.length})</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{displayOrders.reduce((sum, o) => sum + o.totalTons, 0).toFixed(1)}t / {displayOrders.reduce((sum, o) => sum + o.containers, 0)}柜</span>
          </div>
        </div>
      )}

      {/* 桌面端表格视图 */}
      {viewMode === 'table' && !isMobile && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-blue-600 select-none" title={t('sort_hint')} onClick={(e) => handleSort('date', e)}>{t('table_date')}{getSortIcon('date')}</th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-blue-600 select-none" title={t('sort_hint')} onClick={(e) => handleSort('client', e)}>{t('table_client')}{getSortIcon('client')}</th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-blue-600 select-none" title={t('sort_hint')} onClick={(e) => handleSort('styleNo', e)}>{t('table_style')}{getSortIcon('styleNo')}</th>
                <th className="px-3 py-3 text-center">{t('field_spec')}</th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-blue-600 select-none" title={t('sort_hint')} onClick={(e) => handleSort('totalTons', e)}>{t('table_total')}{getSortIcon('totalTons')}</th>
                <th className="px-3 py-3 text-center">{t('table_containers')}</th>
                <th className="px-3 py-3 text-left">{t('table_port')}</th>
                <th className="px-3 py-3 text-left">{t('workshop_status')}</th>
                <th className="px-3 py-3 text-left">{t('table_fulfillment')}</th>
                <th className="px-3 py-3 text-center">{t('table_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {displayOrders.map((order, idx) => {
                const isReadyToShip = order.status === OrderStatus.READY_TO_SHIP;
                const isShipped = order.status === OrderStatus.SHIPPED;
                const { percent, isShortage } = calculateFulfillment(order, inventory, lines, orders);
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
                        {(order.lineIds || order.lineId) && <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{order.lineIds || order.lineId}{t('lines_suffix')}</span>}
                      </td>
                      <td className="px-3 py-3 text-center">{order.packageSpec ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">{order.packageSpec}</span> : <select onChange={(e) => { e.stopPropagation(); const spec = e.target.value as PackageSpec; if (!spec) return; patchOrder(order.id, { packageSpec: spec }).then(() => setOrders(prev => prev.map(o => o.id === order.id ? { ...o, packageSpec: spec } : o))).catch(() => toast.error(t('alert_save_fail'))); }} onClick={(e) => e.stopPropagation()} className="px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-none cursor-pointer"><option value="">-</option><option value={PackageSpec.KG820}>820kg</option><option value={PackageSpec.KG750}>750kg</option><option value={PackageSpec.KG25}>25kg</option></select>}</td>
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
                      <td className="px-3 py-3 relative">
                        {isShipped ? (
                          <span className="text-slate-400">-</span>
                        ) : isReadyToShip ? (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded inline-flex items-center"><Lock size={12} className="mr-1" />{t('status_locked')}</span>
                        ) : (
                          <>
                            <div className="flex items-center space-x-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); setFulfillmentDetailId(fulfillmentDetailId === order.id ? null : order.id); }}>
                              <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2"><div className={`h-2 rounded-full ${isShortage ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                              <span className={`text-xs ${isShortage ? 'text-red-500 font-bold' : 'text-green-600 dark:text-green-400'}`}>{percent.toFixed(0)}%</span>
                            </div>
                            {fulfillmentDetailId === order.id && <FulfillmentPopover order={order} inventory={inventory} lines={lines} t={t} onClose={() => setFulfillmentDetailId(null)} onSave={(alloc) => { patchOrder(order.id, { warehouseAllocation: alloc }).then(() => { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, warehouseAllocation: alloc } : o)); toast.success(t('toast_order_saved')); }).catch(() => toast.error(t('alert_save_fail'))); }} />}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {isUrgent && (
                            <button onClick={(e) => { e.stopPropagation(); onAcknowledgeOrder(order.id); }} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold animate-pulse inline-flex items-center"><AlertCircle size={10} className="mr-0.5" />{t('btn_ack_large')}</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setPrintOrder(order); }} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" title={t('print_packing_list')}><Printer size={14} /></button>
                          {order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.READY_TO_SHIP && <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(order); }} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"><Edit2 size={14} /></button>}
                          {order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.READY_TO_SHIP && <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
                          {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <td colSpan={11} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_po')}</span><span className="font-mono text-slate-700 dark:text-slate-300">{order.piNo}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_bl')}</span><span className="font-mono text-slate-700 dark:text-slate-300">{order.blNo || '-'}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_pkg_per_cont')}</span><span className="text-slate-700 dark:text-slate-300">{order.packagesPerContainer}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_contact')}</span><span className="bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs">{order.contactPerson}</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_trade_type')}</span><span className={`px-2 py-0.5 rounded text-xs ${order.tradeType === TradeType.BONDED ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{order.tradeType === TradeType.BONDED ? t('trade_bonded') : t('trade_general')}</span></div>
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
                <td className="px-3 py-3 text-slate-500 dark:text-slate-400 font-medium" colSpan={5}>{t('total_summary')} ({displayOrders.length} {t('order_unit')})</td>
                <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{displayOrders.reduce((sum, o) => sum + o.totalTons, 0).toFixed(2)}</td>
                <td className="px-3 py-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300">{displayOrders.reduce((sum, o) => sum + o.containers, 0)}</td>
                <td className="bg-slate-100 dark:bg-slate-900" colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
