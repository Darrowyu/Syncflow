import { useState, useEffect, useCallback } from 'react';
import { Order, ProductLine, InventoryItem, IncidentLog, OrderStatus, LineStatus, TradeType, LoadingTimeSlot, WorkshopCommStatus, Style, WarehouseType, PackageSpec, InventoryAlert, TransactionQueryParams, BatchInventoryItem } from '../types';
import { fetchOrders, fetchLines, fetchInventory, fetchIncidents, fetchStyles, patchOrder, updateLine as apiUpdateLine, createLine as apiCreateLine, deleteLine as apiDeleteLine, createOrder, deleteOrder as apiDeleteOrder, createIncident, resolveIncident as apiResolveIncident, deleteIncident as apiDeleteIncident, createStyle as apiCreateStyle, updateStyle as apiUpdateStyle, deleteStyle as apiDeleteStyle, inventoryIn, inventoryOut, inventoryAdjust, inventoryBatchIn, inventoryBatchOut, fetchInventoryTransactions, fetchInventoryAlerts, setSafetyStock as apiSetSafetyStock, lockInventory as apiLockInventory, unlockInventory as apiUnlockInventory, fetchInventoryAuditLogs, invalidateCache } from '../services/api';
import { toast } from '../components/common/Toast';

// 类型转换：API响应 -> 前端类型
const mapOrder = (o: any): Order => ({
  ...o,
  tradeType: o.tradeType === 'Bonded' ? TradeType.BONDED : TradeType.GENERAL,
  status: o.status as OrderStatus,
  loadingTimeSlot: o.loadingTimeSlot as LoadingTimeSlot,
  workshopCommStatus: o.workshopCommStatus as WorkshopCommStatus,
});

const mapLine = (l: any): ProductLine => ({ ...l, status: l.status as LineStatus });
const inventoryKey = (styleNo: string, wt?: string, ps?: string): string => `${styleNo}-${wt || 'general'}-${ps || '820kg'}`; // 库存唯一标识

export function useData() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const loadData = useCallback(async (clearCache = false) => {
    try {
      setLoading(true);
      if (clearCache) invalidateCache(); // 强制刷新时清除缓存
      const [ordersData, linesData, invData, incData, stylesData] = await Promise.all([fetchOrders(), fetchLines(), fetchInventory(), fetchIncidents(), fetchStyles()]);
      setOrders(ordersData.map(mapOrder));
      setLines(linesData.map(mapLine));
      setInventory(invData);
      setIncidents(incData);
      setStyles(stylesData);
      setError(null);
      setLastSyncTime(new Date());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ========== 订单操作 ==========
  const acknowledgeOrder = useCallback(async (id: string) => {
    try {
      await patchOrder(id, { largeOrderAck: true });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, largeOrderAck: true } : o));
      setLastSyncTime(new Date());
      toast.success('大单已确认');
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  const confirmLoad = useCallback(async (id: string, autoDeductStock = true) => {
    try {
      const order = orders.find(o => o.id === id);
      if (order && autoDeductStock) { // 自动扣减库存
        const invItem = inventory.find(i => i.styleNo === order.styleNo);
        if (invItem && invItem.currentStock >= order.totalTons) {
          await inventoryOut({ styleNo: order.styleNo, warehouseType: invItem.warehouseType, packageSpec: invItem.packageSpec, quantity: order.totalTons, grade: 'A', source: '订单发货', note: `订单 ${order.piNo} 发货`, orderId: id });
          setInventory(prev => prev.map(i => i.styleNo === order.styleNo && i.warehouseType === invItem.warehouseType && i.packageSpec === invItem.packageSpec ? { ...i, currentStock: i.currentStock - order.totalTons, gradeA: Math.max(0, i.gradeA - order.totalTons) } : i));
        }
      }
      await patchOrder(id, { status: OrderStatus.SHIPPED });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: OrderStatus.SHIPPED } : o));
      setLastSyncTime(new Date());
      toast.success('装车已确认' + (autoDeductStock ? '，库存已扣减' : ''));
    } catch (e) { toast.error((e as Error).message); }
  }, [orders, inventory]);

  const updateWorkshop = useCallback(async (id: string, workshopCommStatus: WorkshopCommStatus, workshopNote?: string) => {
    await patchOrder(id, { workshopCommStatus, workshopNote });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, workshopCommStatus, workshopNote } : o));
    setLastSyncTime(new Date());
  }, []);

  // ========== 产线操作 ==========
  const updateLineData = useCallback(async (id: number, updates: Partial<ProductLine>) => {
    const line = lines.find(l => l.id === id);
    if (!line) return;
    const newLine = { ...line, ...updates };
    let previousStyle: string | undefined;
    const subLineChanges: { subName: string; fromStyle: string; toStyle: string }[] = [];
    const now = new Date().toISOString();

    // 主线款号变更
    if (updates.currentStyle !== undefined && updates.currentStyle !== line.currentStyle) {
      newLine.styleChangedAt = now;
      previousStyle = line.currentStyle;
    }

    // 分支款号变更
    if (updates.subLines && line.subLines) {
      updates.subLines.forEach((newSub) => {
        const oldSub = line.subLines?.find(s => s.id === newSub.id);
        if (oldSub && oldSub.currentStyle !== newSub.currentStyle) {
          subLineChanges.push({ subName: newSub.name, fromStyle: oldSub.currentStyle, toStyle: newSub.currentStyle });
        }
      });
      if (subLineChanges.length > 0) {
        newLine.styleChangedAt = now;
      }
    }

    await apiUpdateLine(id, { ...newLine, previousStyle, subLineChanges, changeTime: now });
    setLines(prev => prev.map(l => l.id === id ? newLine : l));
    setLastSyncTime(new Date());
  }, [lines]);

  const addLine = useCallback(async (data: Partial<ProductLine>) => {
    const res = await apiCreateLine(data);
    const newId = typeof res.id === 'string' ? parseInt(res.id, 10) : res.id;
    const newLine: ProductLine = { id: newId, name: data.name || `Line ${newId}`, status: data.status || LineStatus.STOPPED, currentStyle: data.currentStyle || '-', dailyCapacity: data.dailyCapacity || 0, exportCapacity: data.exportCapacity || 0, subLines: data.subLines || [] };
    setLines(prev => [...prev, newLine]);
    setLastSyncTime(new Date());
    toast.success('产线已添加');
    return newId;
  }, []);

  const removeLine = useCallback(async (id: number) => {
    await apiDeleteLine(id);
    setLines(prev => prev.filter(l => l.id !== id));
    setLastSyncTime(new Date());
    toast.success('产线已删除');
  }, []);

  const addOrders = useCallback(async (newOrders: Order[]) => {
    for (const o of newOrders) { await createOrder(o); }
    await loadData();
  }, [loadData]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    await patchOrder(id, updates);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    setLastSyncTime(new Date());
  }, []);

  const removeOrder = useCallback(async (id: string) => {
    await apiDeleteOrder(id);
    invalidateCache('orders');
    setOrders(prev => prev.filter(o => o.id !== id));
    setLastSyncTime(new Date());
    toast.success('订单已删除');
  }, []);

  // ========== 异常日志操作 ==========
  const logIncident = useCallback(async (incident: Omit<IncidentLog, 'id' | 'timestamp'>) => {
    try {
      const newInc = { ...incident, id: Date.now().toString(36), timestamp: new Date().toLocaleString() };
      await createIncident(newInc);
      setIncidents(prev => [newInc as IncidentLog, ...prev]);
      setLastSyncTime(new Date());
      toast.success('异常已登记');
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  // ========== 款号操作 ==========
  const addStyle = useCallback(async (data: Omit<Style, 'id'>) => {
    await apiCreateStyle(data);
    await loadData();
    toast.success('款号已添加');
  }, [loadData]);

  const updateStyleData = useCallback(async (id: number, data: Partial<Style>) => {
    await apiUpdateStyle(id, data);
    setStyles(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    setLastSyncTime(new Date());
    toast.success('款号已更新');
  }, []);

  const removeStyle = useCallback(async (id: number) => {
    await apiDeleteStyle(id);
    setStyles(prev => prev.filter(s => s.id !== id));
    setLastSyncTime(new Date());
    toast.success('款号已删除');
  }, []);

  // ========== 库存操作 ==========
  const stockIn = useCallback(async (styleNo: string, quantity: number, grade?: string, source?: string, note?: string, warehouseType?: string, packageSpec?: string) => {
    try {
      const res = await inventoryIn({ styleNo, warehouseType, packageSpec, quantity, grade, source, note });
      const key = inventoryKey(styleNo, warehouseType, packageSpec);
      setInventory(prev => {
        const exists = prev.some(i => inventoryKey(i.styleNo, i.warehouseType, i.packageSpec) === key);
        if (exists) return prev.map(i => inventoryKey(i.styleNo, i.warehouseType, i.packageSpec) === key ? { ...i, currentStock: res.balance, gradeA: res.gradeA, gradeB: res.gradeB } : i);
        return [...prev, { styleNo, warehouseType: (warehouseType || WarehouseType.GENERAL) as WarehouseType, packageSpec: (packageSpec || PackageSpec.KG820) as PackageSpec, currentStock: res.balance, gradeA: res.gradeA, gradeB: res.gradeB, stockTMinus1: 0, lockedForToday: 0 }];
      });
      setLastSyncTime(new Date());
      toast.success(`入库成功: ${styleNo} +${quantity}t`);
      return res.balance;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const stockOut = useCallback(async (styleNo: string, quantity: number, grade?: string, source?: string, note?: string, warehouseType?: string, packageSpec?: string) => {
    try {
      const res = await inventoryOut({ styleNo, warehouseType, packageSpec, quantity, grade, source, note });
      const key = inventoryKey(styleNo, warehouseType, packageSpec);
      setInventory(prev => prev.map(i => inventoryKey(i.styleNo, i.warehouseType, i.packageSpec) === key ? { ...i, currentStock: res.balance, gradeA: res.gradeA, gradeB: res.gradeB } : i));
      setLastSyncTime(new Date());
      toast.success(`出库成功: ${styleNo} -${quantity}t`);
      return res.balance;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const updateStock = useCallback(async (styleNo: string, newGradeA: number, newGradeB: number, warehouseType?: string, packageSpec?: string, reason?: string) => {
    const key = inventoryKey(styleNo, warehouseType, packageSpec);
    try {
      const res = await inventoryAdjust({ styleNo, warehouseType, packageSpec, gradeA: newGradeA, gradeB: newGradeB, reason: reason || '盘点调整' }); // 单次API调用
      setInventory(prev => prev.map(i => inventoryKey(i.styleNo, i.warehouseType, i.packageSpec) === key ? { ...i, gradeA: res.gradeA, gradeB: res.gradeB, currentStock: res.balance } : i));
      setLastSyncTime(new Date());
      toast.success('库存调整成功');
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const getTransactions = useCallback(async (params?: TransactionQueryParams) => {
    return await fetchInventoryTransactions(params);
  }, []);

  const getAlerts = useCallback(async () => {
    return await fetchInventoryAlerts();
  }, []);

  const setSafetyStock = useCallback(async (styleNo: string, safetyStock: number, warehouseType?: string, packageSpec?: string) => {
    const key = inventoryKey(styleNo, warehouseType, packageSpec);
    try {
      await apiSetSafetyStock(styleNo, { warehouseType, packageSpec, safetyStock });
      setInventory(prev => prev.map(i => inventoryKey(i.styleNo, i.warehouseType, i.packageSpec) === key ? { ...i, safetyStock } : i));
      setLastSyncTime(new Date());
      toast.success('安全库存已设置');
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const lockStock = useCallback(async (styleNo: string, quantity: number, warehouseType?: string, packageSpec?: string, reason?: string) => {
    const key = inventoryKey(styleNo, warehouseType, packageSpec);
    try {
      const res = await apiLockInventory(styleNo, { warehouseType, packageSpec, quantity, reason });
      setInventory(prev => prev.map(i => inventoryKey(i.styleNo, i.warehouseType, i.packageSpec) === key ? { ...i, lockedForToday: res.locked } : i));
      setLastSyncTime(new Date());
      toast.success(`已锁定 ${quantity}t`);
      return res.locked;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const unlockStock = useCallback(async (styleNo: string, quantity: number, warehouseType?: string, packageSpec?: string, reason?: string) => {
    const key = inventoryKey(styleNo, warehouseType, packageSpec);
    try {
      const res = await apiUnlockInventory(styleNo, { warehouseType, packageSpec, quantity, reason });
      setInventory(prev => prev.map(i => inventoryKey(i.styleNo, i.warehouseType, i.packageSpec) === key ? { ...i, lockedForToday: res.locked } : i));
      setLastSyncTime(new Date());
      toast.success(`已解锁 ${quantity}t`);
      return res.locked;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const batchStockIn = useCallback(async (items: BatchInventoryItem[]) => {
    try {
      const res = await inventoryBatchIn(items);
      invalidateCache('inventory');
      await loadData();
      toast.success(`批量入库成功: ${res.count}项`);
      return res;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, [loadData]);

  const batchStockOut = useCallback(async (items: BatchInventoryItem[]) => {
    try {
      const res = await inventoryBatchOut(items);
      invalidateCache('inventory');
      await loadData();
      if (res.errors && res.errors.length > 0) toast.warning(`部分出库失败: ${res.errors.length}项`);
      else toast.success(`批量出库成功: ${res.count}项`);
      return res;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, [loadData]);

  const getAuditLogs = useCallback(async (params?: { styleNo?: string; page?: number; pageSize?: number }) => {
    return await fetchInventoryAuditLogs(params);
  }, []);

  const productionIn = useCallback(async (styleNo: string, quantity: number, grade?: string, warehouseType?: string, packageSpec?: string, lineId?: number, subLineId?: string) => {
    await inventoryIn({ styleNo, warehouseType, packageSpec, quantity, grade: grade || 'A', source: '生产入库', note: `产线完成生产 ${quantity}t` });
    if (lineId) { // 入库完成后清零指定产线的exportCapacity
      const line = lines.find(l => l.id === lineId);
      if (line) {
        if (subLineId && line.subLines) {
          const newSubs = line.subLines.map(sub => sub.id === subLineId ? { ...sub, exportCapacity: 0 } : sub);
          await apiUpdateLine(line.id, { ...line, subLines: newSubs });
        } else {
          await apiUpdateLine(line.id, { ...line, exportCapacity: 0 });
        }
      }
    }
    invalidateCache(); // 清除缓存确保获取最新数据
    await loadData();
    toast.success(`入库成功: ${styleNo} +${quantity}t`);
  }, [lines, loadData]);

  const completeProduction = useCallback(async (lineId: number, styleNo: string, quantity: number, grade?: string, warehouseType?: string, packageSpec?: string) => {
    await inventoryIn({ styleNo, warehouseType, packageSpec, quantity, grade: grade || 'A', source: '生产入库', note: `产线${lineId}完成生产 ${quantity}t` });
    await loadData();
  }, [loadData]);

  const resolveIncident = useCallback(async (id: string, resolved: boolean) => {
    await apiResolveIncident(id, resolved);
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, resolved, resolvedAt: resolved ? new Date().toISOString() : undefined } : i));
    setLastSyncTime(new Date());
    toast.success(resolved ? '异常已处理' : '异常已重新打开');
  }, []);

  const removeIncident = useCallback(async (id: string) => {
    await apiDeleteIncident(id);
    setIncidents(prev => prev.filter(i => i.id !== id));
    setLastSyncTime(new Date());
    toast.success('异常已删除');
  }, []);

  return { orders, setOrders, lines, inventory, incidents, styles, loading, error, lastSyncTime, acknowledgeOrder, confirmLoad, updateWorkshop, updateOrder, removeOrder, updateLine: updateLineData, addLine, removeLine, addOrders, logIncident, resolveIncident, removeIncident, addStyle, updateStyle: updateStyleData, removeStyle, reload: loadData, stockIn, stockOut, updateStock, getTransactions, productionIn, completeProduction, getAlerts, setSafetyStock, lockStock, unlockStock, batchStockIn, batchStockOut, getAuditLogs };
}
