import { useState, useEffect, useCallback } from 'react';
import { Order, ProductLine, InventoryItem, IncidentLog, OrderStatus, LineStatus, TradeType, LoadingTimeSlot, WorkshopCommStatus, Style, WarehouseType, PackageSpec, TransactionQueryParams, BatchInventoryItem } from '../types';
import { fetchOrders, fetchLines, fetchInventory, fetchIncidents, fetchStyles, patchOrder, updateLine as apiUpdateLine, createLine as apiCreateLine, deleteLine as apiDeleteLine, createOrder, deleteOrder as apiDeleteOrder, createIncident, resolveIncident as apiResolveIncident, deleteIncident as apiDeleteIncident, createStyle as apiCreateStyle, updateStyle as apiUpdateStyle, deleteStyle as apiDeleteStyle, inventoryIn, inventoryOut, inventoryAdjust, inventoryBatchIn, inventoryBatchOut, fetchInventoryTransactions, fetchInventoryAlerts, setSafetyStock as apiSetSafetyStock, lockInventory as apiLockInventory, unlockInventory as apiUnlockInventory, fetchInventoryAuditLogs, invalidateCache } from '../services/api';
import { toast } from '../components/common/Toast';

// API 响应类型
interface ApiOrder { id: string; date: string; client: string; styleNo: string; packageSpec?: string; piNo: string; lineId?: number; lineIds?: string; blNo?: string; totalTons: number; containers: number; packagesPerContainer: number; port: string; contactPerson: string; tradeType: string; requirements: string; status: string; isLargeOrder: boolean; largeOrderAck: boolean; loadingTimeSlot?: string; workshopCommStatus?: string; workshopNote?: string; prepDaysRequired?: number; warehouseAllocation?: { general: number; bonded: number }; }
interface ApiLine { id: number; name: string; status: string; currentStyle: string; dailyCapacity: number; exportCapacity?: number; note?: string; styleChangedAt?: string; subLines?: unknown[]; }

// 类型转换
const mapOrder = (o: ApiOrder): Order => ({ ...o, tradeType: o.tradeType === 'Bonded' ? TradeType.BONDED : TradeType.GENERAL, status: o.status as OrderStatus, loadingTimeSlot: o.loadingTimeSlot as LoadingTimeSlot, workshopCommStatus: o.workshopCommStatus as WorkshopCommStatus });
const mapLine = (l: ApiLine): ProductLine => ({ ...l, status: l.status as LineStatus });
const invKey = (styleNo: string, wt?: string, ps?: string, lineId?: number) => `${styleNo}-${wt || 'general'}-${ps || '820kg'}-${lineId || 'noLine'}`;
const now = () => new Date();

// 通用异步操作包装器
const wrapAsync = <T extends (...args: any[]) => Promise<any>>(fn: T, successMsg: string, setSyncTime: () => void): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
  return async (...args) => {
    try {
      const result = await fn(...args);
      setSyncTime();
      if (successMsg) toast.success(successMsg);
      return result;
    } catch (e) { toast.error((e as Error).message); throw e; }
  };
};

// 通用CRUD工厂
const createCrud = <T extends { id: string | number }>(name: string, setState: React.Dispatch<React.SetStateAction<T[]>>, setSyncTime: () => void, api: { create?: (d: any) => Promise<any>; update?: (id: any, d: any) => Promise<any>; remove?: (id: any) => Promise<any> }) => ({
  add: api.create ? wrapAsync(async (data: Omit<T, 'id'>) => { await api.create!(data); invalidateCache(name); const items = await (name === 'styles' ? fetchStyles() : fetchLines()); setState(items as T[]); return items; }, `${name}已添加`, setSyncTime) : undefined,
  update: api.update ? wrapAsync(async (id: string | number, data: Partial<T>) => { await api.update!(id, data); setState(prev => prev.map(item => item.id === id ? { ...item, ...data } : item)); }, `${name}已更新`, setSyncTime) : undefined,
  remove: api.remove ? wrapAsync(async (id: string | number) => { await api.remove!(id); setState(prev => prev.filter(item => item.id !== id)); }, `${name}已删除`, setSyncTime) : undefined,
});

export function useData() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const setSync = useCallback(() => setLastSyncTime(now()), []);

  // 数据加载
  const loadData = useCallback(async (clearCache = false) => {
    try {
      setLoading(true);
      if (clearCache) invalidateCache();
      const [ordersData, linesData, invData, incData, stylesData] = await Promise.all([fetchOrders(), fetchLines(), fetchInventory(), fetchIncidents(), fetchStyles()]);
      setOrders(ordersData.map(mapOrder));
      setLines(linesData.map(mapLine));
      setInventory(invData);
      setIncidents(incData);
      setStyles(stylesData);
      setError(null);
      setSync();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [setSync]);

  useEffect(() => { loadData(); }, [loadData]);

  // 订单操作
  const acknowledgeOrder = wrapAsync(async (id: string) => { await patchOrder(id, { largeOrderAck: true }); setOrders(prev => prev.map(o => o.id === id ? { ...o, largeOrderAck: true } : o)); }, '大单已确认', setSync);
  
  const confirmLoad = wrapAsync(async (id: string, autoDeduct = true) => {
    const order = orders.find(o => o.id === id);
    if (order && autoDeduct) {
      const deduct = async (whType: 'general' | 'bonded', qty: number) => {
        if (qty <= 0) return;
        const item = inventory.find(i => i.styleNo === order.styleNo && i.warehouseType === whType);
        if (item?.currentStock >= qty) {
          await inventoryOut({ styleNo: order.styleNo, warehouseType: whType, packageSpec: item.packageSpec, quantity: qty, grade: 'A', source: '订单发货', note: `订单 ${order.piNo} 发货`, orderId: id });
          setInventory(prev => prev.map(i => i.styleNo === order.styleNo && i.warehouseType === whType ? { ...i, currentStock: i.currentStock - qty, gradeA: Math.max(0, i.gradeA - qty) } : i));
        }
      };
      if (order.warehouseAllocation) { await deduct('general', order.warehouseAllocation.general); await deduct('bonded', order.warehouseAllocation.bonded); }
      else { await deduct(order.tradeType === 'Bonded' ? 'bonded' : 'general', order.totalTons); }
    }
    await patchOrder(id, { status: OrderStatus.SHIPPED });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: OrderStatus.SHIPPED } : o));
  }, '装车已确认，库存已扣减', setSync);

  const updateWorkshop = wrapAsync(async (id: string, status: WorkshopCommStatus, note?: string) => { await patchOrder(id, { workshopCommStatus: status, workshopNote: note }); setOrders(prev => prev.map(o => o.id === id ? { ...o, workshopCommStatus: status, workshopNote: note } : o)); }, '', setSync);
  const addOrders = wrapAsync(async (newOrders: Order[]) => { for (const o of newOrders) await createOrder(o); await loadData(); }, '', setSync);
  const updateOrder = wrapAsync(async (id: string, updates: Partial<Order>) => { await patchOrder(id, updates); setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o)); }, '', setSync);
  const removeOrder = wrapAsync(async (id: string) => { await apiDeleteOrder(id); invalidateCache('orders'); setOrders(prev => prev.filter(o => o.id !== id)); }, '订单已删除', setSync);

  // 产线操作
  const updateLine = wrapAsync(async (id: number, updates: Partial<ProductLine>) => {
    const line = lines.find(l => l.id === id); if (!line) return;
    const newLine = { ...line, ...updates };
    const prevStyle = updates.currentStyle !== undefined && updates.currentStyle !== line.currentStyle ? line.currentStyle : undefined;
    const subChanges = updates.subLines?.map(newSub => { const oldSub = line.subLines?.find(s => s.id === newSub.id); return oldSub && oldSub.currentStyle !== newSub.currentStyle ? { subName: newSub.name, fromStyle: oldSub.currentStyle, toStyle: newSub.currentStyle } : null; }).filter(Boolean) || [];
    if (prevStyle || subChanges.length) newLine.styleChangedAt = now().toISOString();
    await apiUpdateLine(id, { ...newLine, previousStyle: prevStyle, subLineChanges: subChanges, changeTime: now().toISOString() });
    setLines(prev => prev.map(l => l.id === id ? newLine : l));
  }, '', setSync);

  const addLine = wrapAsync(async (data: Partial<ProductLine>) => {
    const res = await apiCreateLine(data);
    const newId = typeof res.id === 'string' ? parseInt(res.id, 10) : res.id;
    setLines(prev => [...prev, { id: newId, name: data.name || `Line ${newId}`, status: data.status || LineStatus.STOPPED, currentStyle: data.currentStyle || '-', dailyCapacity: data.dailyCapacity || 0, exportCapacity: data.exportCapacity || 0, subLines: data.subLines || [] }]);
    return newId;
  }, '产线已添加', setSync);

  const removeLine = wrapAsync(async (id: number) => { await apiDeleteLine(id); setLines(prev => prev.filter(l => l.id !== id)); }, '产线已删除', setSync);

  // 异常操作
  const logIncident = wrapAsync(async (incident: Omit<IncidentLog, 'id' | 'timestamp'>) => { const newInc = { ...incident, id: Date.now().toString(36), timestamp: new Date().toLocaleString() }; await createIncident(newInc); setIncidents(prev => [newInc as IncidentLog, ...prev]); }, '异常已登记', setSync);
  const resolveIncident = wrapAsync(async (id: string, resolved: boolean) => { await apiResolveIncident(id, resolved); setIncidents(prev => prev.map(i => i.id === id ? { ...i, resolved, resolvedAt: resolved ? now().toISOString() : undefined } : i)); }, resolved => resolved ? '异常已处理' : '异常已重新打开', setSync);
  const removeIncident = wrapAsync(async (id: string) => { await apiDeleteIncident(id); setIncidents(prev => prev.filter(i => i.id !== id)); }, '异常已删除', setSync);

  // 款号CRUD
  const styleCrud = createCrud<Style>('款号', setStyles, setSync, { create: apiCreateStyle, update: apiUpdateStyle, remove: apiDeleteStyle });

  // 库存操作
  const updateInvState = (key: string, res: { balance: number; gradeA: number; gradeB: number }, createNew?: InventoryItem) => {
    setInventory(prev => {
      const exists = prev.some(i => invKey(i.styleNo, i.warehouseType, i.packageSpec, i.lineId) === key);
      if (exists) return prev.map(i => invKey(i.styleNo, i.warehouseType, i.packageSpec, i.lineId) === key ? { ...i, currentStock: res.balance, gradeA: res.gradeA, gradeB: res.gradeB } : i);
      return createNew ? [...prev, createNew] : prev;
    });
  };

  const stockIn = wrapAsync(async (styleNo: string, qty: number, grade?: string, source?: string, note?: string, wt?: string, ps?: string) => {
    const res = await inventoryIn({ styleNo, warehouseType: wt, packageSpec: ps, quantity: qty, grade, source, note });
    const key = invKey(styleNo, wt, ps);
    updateInvState(key, res, { styleNo, warehouseType: (wt || WarehouseType.GENERAL) as WarehouseType, packageSpec: (ps || PackageSpec.KG820) as PackageSpec, currentStock: res.balance, gradeA: res.gradeA, gradeB: res.gradeB, stockTMinus1: 0, lockedForToday: 0 });
    return res.balance;
  }, (styleNo, qty) => `入库成功: ${styleNo} +${qty}t`, setSync);

  const stockOut = wrapAsync(async (styleNo: string, qty: number, grade?: string, source?: string, note?: string, wt?: string, ps?: string) => {
    const res = await inventoryOut({ styleNo, warehouseType: wt, packageSpec: ps, quantity: qty, grade, source, note });
    updateInvState(invKey(styleNo, wt, ps), res);
    return res.balance;
  }, (styleNo, qty) => `出库成功: ${styleNo} -${qty}t`, setSync);

  const updateStock = wrapAsync(async (styleNo: string, gradeA: number, gradeB: number, wt?: string, ps?: string, reason?: string, lineId?: number, lineName?: string) => {
    const res = await inventoryAdjust({ styleNo, warehouseType: wt, packageSpec: ps, gradeA, gradeB, reason: reason || '盘点调整', lineId, lineName });
    setInventory(prev => prev.map(i => invKey(i.styleNo, i.warehouseType, i.packageSpec, i.lineId) === invKey(styleNo, wt, ps, lineId) ? { ...i, gradeA: res.gradeA, gradeB: res.gradeB, currentStock: res.balance } : i));
  }, '库存调整成功', setSync);

  const setSafetyStock = wrapAsync(async (styleNo: string, safetyStock: number, wt?: string, ps?: string) => {
    await apiSetSafetyStock(styleNo, { warehouseType: wt, packageSpec: ps, safetyStock });
    setInventory(prev => prev.map(i => invKey(i.styleNo, i.warehouseType, i.packageSpec, i.lineId) === invKey(styleNo, wt, ps) ? { ...i, safetyStock } : i));
  }, '安全库存已设置', setSync);

  const lockStock = wrapAsync(async (styleNo: string, qty: number, wt?: string, ps?: string, reason?: string) => { const res = await apiLockInventory(styleNo, { warehouseType: wt, packageSpec: ps, quantity: qty, reason }); setInventory(prev => prev.map(i => invKey(i.styleNo, i.warehouseType, i.packageSpec, i.lineId) === invKey(styleNo, wt, ps) ? { ...i, lockedForToday: res.locked } : i)); return res.locked; }, qty => `已锁定 ${qty}t`, setSync);
  
  const unlockStock = wrapAsync(async (styleNo: string, qty: number, wt?: string, ps?: string, reason?: string) => { const res = await apiUnlockInventory(styleNo, { warehouseType: wt, packageSpec: ps, quantity: qty, reason }); setInventory(prev => prev.map(i => invKey(i.styleNo, i.warehouseType, i.packageSpec, i.lineId) === invKey(styleNo, wt, ps) ? { ...i, lockedForToday: res.locked } : i)); return res.locked; }, qty => `已解锁 ${qty}t`, setSync);

  const batchStockIn = wrapAsync(async (items: BatchInventoryItem[]) => { const res = await inventoryBatchIn(items); invalidateCache('inventory'); await loadData(); return res; }, res => `批量入库成功: ${res.count}项`, setSync);
  const batchStockOut = wrapAsync(async (items: BatchInventoryItem[]) => { const res = await inventoryBatchOut(items); invalidateCache('inventory'); await loadData(); if (res.errors?.length) toast.warning(`部分出库失败: ${res.errors.length}项`); return res; }, res => `批量出库成功: ${res.count}项`, setSync);

  const productionIn = wrapAsync(async (styleNo: string, qty: number, grade?: string, wt?: string, ps?: string, lineId?: number, subLineId?: string, lineName?: string) => {
    await inventoryIn({ styleNo, warehouseType: wt, packageSpec: ps, quantity: qty, grade: grade || 'A', source: '生产入库', note: `产线${lineName || lineId || ''}完成生产 ${qty}t`, lineId, lineName });
    if (lineId) {
      const line = lines.find(l => l.id === lineId);
      if (line) {
        const newSubs = subLineId && line.subLines ? line.subLines.map(sub => sub.id === subLineId ? { ...sub, exportCapacity: 0 } : sub) : undefined;
        await apiUpdateLine(line.id, newSubs ? { ...line, subLines: newSubs } : { ...line, exportCapacity: 0 });
      }
    }
    invalidateCache(); await loadData();
  }, (styleNo, qty, lineName) => `入库成功: ${styleNo} +${qty}t (${lineName || '未指定产线'})`, setSync);

  // 查询操作
  const getTransactions = useCallback(async (params?: TransactionQueryParams) => fetchInventoryTransactions(params), []);
  const getAlerts = useCallback(async () => fetchInventoryAlerts(), []);
  const getAuditLogs = useCallback(async (params?: { styleNo?: string; page?: number; pageSize?: number }) => fetchInventoryAuditLogs(params), []);

  return {
    orders, setOrders, lines, inventory, incidents, styles, loading, error, lastSyncTime,
    acknowledgeOrder, confirmLoad, updateWorkshop, updateOrder, removeOrder, addOrders,
    updateLine, addLine, removeLine,
    logIncident, resolveIncident, removeIncident,
    addStyle: styleCrud.add!, updateStyle: styleCrud.update!, removeStyle: styleCrud.remove!,
    reload: loadData,
    stockIn, stockOut, updateStock, productionIn, setSafetyStock, lockStock, unlockStock, batchStockIn, batchStockOut,
    getTransactions, getAlerts, getAuditLogs
  };
}
