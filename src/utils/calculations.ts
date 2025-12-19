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

export interface FulfillmentOptions {
  includeProduction?: boolean; // 是否计入今日产线产能
}

export const calculateFulfillment = (
  order: Order,
  inventory: InventoryItem[],
  lines: ProductLine[],
  allOrders?: Order[], // 所有订单（用于计算其他订单占用）
  options?: FulfillmentOptions
): FulfillmentResult => {
  const { includeProduction = false } = options || {};

  // 齐料待发订单：库存已锁定，满足率固定100%
  if (order.status === OrderStatus.READY_TO_SHIP) {
    return { available: order.totalTons, percent: 100, isShortage: false };
  }

  // 获取指定仓库的可用库存（扣除锁定量）
  const getAvailableStock = (whType: 'general' | 'bonded'): number => {
    const matchItems = order.packageSpec
      ? inventory.filter(i => i.styleNo === order.styleNo && i.warehouseType === whType && i.packageSpec === order.packageSpec)
      : inventory.filter(i => i.styleNo === order.styleNo && i.warehouseType === whType);
    return matchItems.reduce((sum, i) => sum + Math.max(0, i.currentStock - (i.lockedForToday || 0)), 0);
  };

  // 计算"齐料待发"订单锁定的库存量（优先级最高，必须先扣除）
  const getReadyToShipLocked = (whType: 'general' | 'bonded'): number => {
    if (!allOrders) return 0;
    return allOrders
      .filter(o => o.id !== order.id && o.styleNo === order.styleNo && o.status === OrderStatus.READY_TO_SHIP) // 仅齐料待发订单
      .filter(o => {
        if (o.warehouseAllocation) return true;
        return (o.tradeType === 'Bonded' ? 'bonded' : 'general') === whType;
      })
      .reduce((sum, o) => {
        if (o.warehouseAllocation) {
          return sum + (whType === 'general' ? o.warehouseAllocation.general : o.warehouseAllocation.bonded);
        }
        return sum + o.totalTons;
      }, 0);
  };

  // 计算其他普通订单（待处理/生产中）对库存的占用量
  const getOtherOrdersOccupied = (whType: 'general' | 'bonded'): number => {
    if (!allOrders) return 0;
    return allOrders
      .filter(o => o.id !== order.id && o.styleNo === order.styleNo) // 同款号其他订单
      .filter(o => o.status !== OrderStatus.SHIPPED && o.status !== OrderStatus.READY_TO_SHIP) // 排除已发货和齐料待发（已单独计算）
      .filter(o => {
        if (o.warehouseAllocation) return true;
        return (o.tradeType === 'Bonded' ? 'bonded' : 'general') === whType;
      })
      .reduce((sum, o) => {
        if (o.warehouseAllocation) {
          return sum + (whType === 'general' ? o.warehouseAllocation.general : o.warehouseAllocation.bonded);
        }
        return sum + o.totalTons;
      }, 0);
  };

  // 计算今日产线产能（可选）
  const getTodayProduction = (): number => {
    if (!includeProduction) return 0;
    return calculateStyleProduction(order.styleNo, lines);
  };

  let availableStock = 0;

  if (order.warehouseAllocation) {
    // 有仓库分配：分别计算两个仓库的可用量
    const { general: allocGeneral, bonded: allocBonded } = order.warehouseAllocation;
    // 可用库存 = 总库存 - 齐料待发锁定 - 其他订单占用
    const generalStock = Math.max(0, getAvailableStock('general') - getReadyToShipLocked('general') - getOtherOrdersOccupied('general'));
    const bondedStock = Math.max(0, getAvailableStock('bonded') - getReadyToShipLocked('bonded') - getOtherOrdersOccupied('bonded'));
    availableStock = Math.min(allocGeneral, generalStock) + Math.min(allocBonded, bondedStock);
  } else {
    // 无分配：按贸易类型取对应仓库
    const whType = order.tradeType === 'Bonded' ? 'bonded' : 'general';
    // 可用库存 = 总库存 - 齐料待发锁定 - 其他订单占用
    availableStock = Math.max(0, getAvailableStock(whType) - getReadyToShipLocked(whType) - getOtherOrdersOccupied(whType));
  }

  // 加上今日产能
  const totalAvailable = availableStock + getTodayProduction();

  const percent = order.totalTons > 0 ? Math.min(100, (totalAvailable / order.totalTons) * 100) : 100;
  return { available: totalAvailable, percent, isShortage: totalAvailable < order.totalTons };
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
  return orders.filter(o => o.date === today && o.status === OrderStatus.READY_TO_SHIP);
};

export const getUpcomingShipments = (orders: Order[]): Order[] => { // 获取近期待发货订单（未发货且日期在今日之后）
  const today = new Date().toISOString().split('T')[0];
  return orders
    .filter(o => o.date > today && o.status !== OrderStatus.SHIPPED)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
};


