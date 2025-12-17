import { Order, InventoryItem, ProductLine, OrderStatus } from '../types';

export interface FulfillmentResult {
  available: number;
  percent: number;
  isShortage: boolean;
}

export interface ChartDataItem {
  name: string;
  Demand: number;
  Stock: number;
  Production: number;
  TotalAvailable: number;
  Coverage: number;
}

export const calculateExportCapacity = (line: ProductLine): number => { // 计算单条产线外贸可用产能
  if (line.status !== 'Running') return 0;
  if (line.subLines && line.subLines.length > 0) {
    return line.subLines.reduce((sum, sub) => sum + (sub.exportCapacity || 0), 0);
  }
  return line.exportCapacity || 0;
};

export const calculateStyleProduction = (styleNo: string, lines: ProductLine[]): number => { // 计算某款号今日外贸产量
  let total = 0;
  lines.filter(l => l.status === 'Running').forEach(l => {
    if (l.subLines && l.subLines.length > 0) {
      l.subLines.filter(sub => sub.currentStyle === styleNo).forEach(sub => { total += sub.exportCapacity || 0; });
    } else if (l.currentStyle === styleNo) {
      total += l.exportCapacity || 0;
    }
  });
  return total;
};

export const calculateFulfillment = (order: Order, inventory: InventoryItem[], _lines: ProductLine[]): FulfillmentResult => { // 计算订单满足率（基于真实库存）
  const stock = inventory.find(i => i.styleNo === order.styleNo)?.currentStock || 0;
  const available = stock;
  const percent = order.totalTons > 0 ? Math.min(100, (available / order.totalTons) * 100) : 100;
  return { available, percent, isShortage: available < order.totalTons };
};

export const calculateChartData = (orders: Order[], inventory: InventoryItem[], lines: ProductLine[]): ChartDataItem[] => { // 生成图表数据（含产能）
  const styles = Array.from(new Set([...orders.map(o => o.styleNo), ...inventory.map(i => i.styleNo)]));
  return styles.map(style => {
    const demand = orders.filter(o => o.styleNo === style && o.status !== OrderStatus.SHIPPED).reduce((sum, o) => sum + o.totalTons, 0);
    const currentStock = inventory.find(i => i.styleNo === style)?.currentStock || 0;
    const production = calculateStyleProduction(style, lines);
    const totalAvailable = currentStock + production;
    return {
      name: style,
      Demand: parseFloat(demand.toFixed(2)),
      Stock: parseFloat(currentStock.toFixed(2)),
      Production: parseFloat(production.toFixed(2)),
      TotalAvailable: parseFloat(totalAvailable.toFixed(2)),
      Coverage: demand > 0 ? (totalAvailable / demand) * 100 : 100
    };
  }).filter(d => d.Demand > 0 || d.TotalAvailable > 0); // 过滤无数据款号
};

export const getPendingOrders = (orders: Order[]): Order[] => orders.filter(o => o.status !== OrderStatus.SHIPPED); // 获取所有未发货订单

export const getCriticalAlerts = (orders: Order[]): Order[] => orders.filter(o => o.isLargeOrder && !o.largeOrderAck && o.status !== OrderStatus.SHIPPED); // 获取大货预警

export const getTodayShipments = (orders: Order[]): Order[] => { // 获取今日待发货（齐料待发）
  const today = new Date().toISOString().split('T')[0];
  return orders.filter(o => (o.expectedShipDate === today || o.date === today) && o.status === OrderStatus.READY_TO_SHIP);
};

export const getUpcomingShipments = (orders: Order[]): Order[] => { // 获取近期待发货订单（有预计发货日且未发货）
  const today = new Date().toISOString().split('T')[0];
  return orders
    .filter(o => o.expectedShipDate && o.expectedShipDate > today && o.status !== OrderStatus.SHIPPED)
    .sort((a, b) => (a.expectedShipDate || '').localeCompare(b.expectedShipDate || ''))
    .slice(0, 10);
};


