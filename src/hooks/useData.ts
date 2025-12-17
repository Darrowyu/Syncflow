import { useState, useEffect, useCallback } from 'react';
import { Order, ProductLine, InventoryItem, IncidentLog, OrderStatus, LineStatus, TradeType, LoadingTimeSlot, WorkshopCommStatus, Style } from '../types';
import { fetchOrders, fetchLines, fetchInventory, fetchIncidents, fetchStyles, patchOrder, updateLine as apiUpdateLine, createLine as apiCreateLine, deleteLine as apiDeleteLine, createOrder, createIncident, resolveIncident as apiResolveIncident, deleteIncident as apiDeleteIncident, createStyle as apiCreateStyle, updateStyle as apiUpdateStyle, deleteStyle as apiDeleteStyle, inventoryIn, inventoryOut, updateInventory as apiUpdateInventory, fetchInventoryTransactions, invalidateCache } from '../services/api';
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

export function useData() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const acknowledgeOrder = useCallback(async (id: string) => {
    try {
      await patchOrder(id, { largeOrderAck: true });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, largeOrderAck: true } : o));
      toast.success('大单已确认');
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  const confirmLoad = useCallback(async (id: string) => {
    try {
      await patchOrder(id, { status: OrderStatus.SHIPPED });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: OrderStatus.SHIPPED } : o));
      toast.success('装车已确认');
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  const updateWorkshop = useCallback(async (id: string, workshopCommStatus: WorkshopCommStatus, workshopNote?: string) => {
    await patchOrder(id, { workshopCommStatus, workshopNote });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, workshopCommStatus, workshopNote } : o));
  }, []);

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
  }, [lines]);

  const addLine = useCallback(async (data: Partial<ProductLine>) => {
    const res = await apiCreateLine(data);
    const newId = typeof res.id === 'string' ? parseInt(res.id, 10) : res.id;
    const newLine: ProductLine = { id: newId, name: data.name || `Line ${newId}`, status: data.status || LineStatus.STOPPED, currentStyle: data.currentStyle || '-', dailyCapacity: data.dailyCapacity || 0, exportCapacity: data.exportCapacity || 0, subLines: data.subLines || [] };
    setLines(prev => [...prev, newLine]);
    toast.success('产线已添加');
    return newId;
  }, []);

  const removeLine = useCallback(async (id: number) => {
    await apiDeleteLine(id);
    setLines(prev => prev.filter(l => l.id !== id));
    toast.success('产线已删除');
  }, []);

  const addOrders = useCallback(async (newOrders: Order[]) => {
    for (const o of newOrders) { await createOrder(o); }
    await loadData();
  }, [loadData]);

  const logIncident = useCallback(async (incident: Omit<IncidentLog, 'id' | 'timestamp'>) => {
    try {
      const newInc = { ...incident, id: Date.now().toString(36), timestamp: new Date().toLocaleString() };
      await createIncident(newInc);
      setIncidents(prev => [newInc as IncidentLog, ...prev]);
      toast.success('异常已登记');
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  const addStyle = useCallback(async (data: Omit<Style, 'id'>) => {
    await apiCreateStyle(data);
    await loadData();
    toast.success('款号已添加');
  }, [loadData]);

  const updateStyleData = useCallback(async (id: number, data: Partial<Style>) => {
    await apiUpdateStyle(id, data);
    setStyles(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    toast.success('款号已更新');
  }, []);

  const removeStyle = useCallback(async (id: number) => {
    await apiDeleteStyle(id);
    setStyles(prev => prev.filter(s => s.id !== id));
    toast.success('款号已删除');
  }, []);

  const stockIn = useCallback(async (styleNo: string, quantity: number, grade?: string, source?: string, note?: string) => {
    try {
      const res = await inventoryIn({ styleNo, quantity, grade, source, note });
      setInventory(prev => prev.map(i => i.styleNo === styleNo ? { ...i, currentStock: res.balance, gradeA: res.gradeA, gradeB: res.gradeB } : i));
      toast.success(`入库成功: ${styleNo} +${quantity}t`);
      return res.balance;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const stockOut = useCallback(async (styleNo: string, quantity: number, grade?: string, source?: string, note?: string) => {
    try {
      const res = await inventoryOut({ styleNo, quantity, grade, source, note });
      setInventory(prev => prev.map(i => i.styleNo === styleNo ? { ...i, currentStock: res.balance, gradeA: res.gradeA, gradeB: res.gradeB } : i));
      toast.success(`出库成功: ${styleNo} -${quantity}t`);
      return res.balance;
    } catch (e) { toast.error((e as Error).message); throw e; }
  }, []);

  const updateStock = useCallback(async (styleNo: string, gradeA: number, gradeB: number) => { // 直接修改库存
    const currentStock = gradeA + gradeB;
    await apiUpdateInventory(styleNo, { currentStock, gradeA, gradeB, stockTMinus1: currentStock, lockedForToday: 0 });
    setInventory(prev => prev.map(i => i.styleNo === styleNo ? { ...i, currentStock, gradeA, gradeB } : i));
  }, []);

  const getTransactions = useCallback(async (styleNo?: string) => { // 获取流水
    return await fetchInventoryTransactions(styleNo);
  }, []);

  const productionIn = useCallback(async (styleNo: string, quantity: number, grade?: string) => { // 生产入库并清零产线产能
    await inventoryIn({ styleNo, quantity, grade: grade || 'A', source: '生产入库', note: `产线完成生产 ${quantity}t` });
    // 清零所有生产该款号的产线外贸产能
    for (const line of lines) {
      if (line.status !== LineStatus.RUNNING) continue;
      if (line.subLines && line.subLines.length > 0) {
        const newSubs = line.subLines.map(sub => sub.currentStyle === styleNo ? { ...sub, exportCapacity: 0 } : sub);
        if (newSubs.some((s, i) => s.exportCapacity !== line.subLines![i].exportCapacity)) {
          await apiUpdateLine(line.id, { ...line, subLines: newSubs });
        }
      } else if (line.currentStyle === styleNo) {
        await apiUpdateLine(line.id, { ...line, exportCapacity: 0 });
      }
    }
    await loadData();
  }, [lines, loadData]);

  const completeProduction = useCallback(async (lineId: number, styleNo: string, quantity: number, grade?: string) => { // 排产页面完成生产入库
    await inventoryIn({ styleNo, quantity, grade: grade || 'A', source: '生产入库', note: `产线${lineId}完成生产 ${quantity}t` });
    await loadData();
  }, [loadData]);

  const resolveIncident = useCallback(async (id: string, resolved: boolean) => {
    await apiResolveIncident(id, resolved);
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, resolved, resolvedAt: resolved ? new Date().toISOString() : undefined } : i));
    toast.success(resolved ? '异常已处理' : '异常已重新打开');
  }, []);

  const removeIncident = useCallback(async (id: string) => {
    await apiDeleteIncident(id);
    setIncidents(prev => prev.filter(i => i.id !== id));
    toast.success('异常已删除');
  }, []);

  return { orders, setOrders, lines, inventory, incidents, styles, loading, error, acknowledgeOrder, confirmLoad, updateWorkshop, updateLine: updateLineData, addLine, removeLine, addOrders, logIncident, resolveIncident, removeIncident, addStyle, updateStyle: updateStyleData, removeStyle, reload: loadData, stockIn, stockOut, updateStock, getTransactions, productionIn, completeProduction };
}
