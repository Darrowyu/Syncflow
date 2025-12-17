import { Order, OrderStatus, TradeType, ProductLine, InventoryItem, LineStatus, IncidentLog, LoadingTimeSlot, WorkshopCommStatus } from '../types';

// 初始数据仅用于备用/演示，实际数据从数据库加载
export const INITIAL_INVENTORY: InventoryItem[] = [
  { styleNo: 'BE3250', currentStock: 80, gradeA: 80, gradeB: 0, stockTMinus1: 80, lockedForToday: 0 },
  { styleNo: 'BE2250', currentStock: 5, gradeA: 5, gradeB: 0, stockTMinus1: 5, lockedForToday: 0 },
  { styleNo: 'BE3340', currentStock: 250, gradeA: 250, gradeB: 0, stockTMinus1: 250, lockedForToday: 0 },
];

export const INITIAL_LINES: ProductLine[] = [
  { id: 1, name: 'Line 1', status: LineStatus.RUNNING, currentStyle: 'BE3250', dailyCapacity: 50, exportCapacity: 30 },
  { id: 2, name: 'Line 2', status: LineStatus.RUNNING, currentStyle: 'BE3250', dailyCapacity: 45, exportCapacity: 23 },
  { id: 3, name: 'Line 3', status: LineStatus.RUNNING, currentStyle: 'BE2250', dailyCapacity: 40, exportCapacity: 8 },
  { id: 4, name: 'Line 4', status: LineStatus.STOPPED, currentStyle: '-', dailyCapacity: 0, exportCapacity: 0 },
  { id: 5, name: 'Line 5', status: LineStatus.RUNNING, currentStyle: 'BE3340', dailyCapacity: 60, exportCapacity: 48 },
  { id: 6, name: 'Line 6', status: LineStatus.RUNNING, currentStyle: 'BE3340', dailyCapacity: 55, exportCapacity: 38 },
  { id: 7, name: 'Line 7', status: LineStatus.MAINTENANCE, currentStyle: '-', dailyCapacity: 0, exportCapacity: 0 },
  { id: 8, name: 'Line 8', status: LineStatus.RUNNING, currentStyle: 'BE3250', dailyCapacity: 40, exportCapacity: 20 },
  { id: 9, name: 'Line 9', status: LineStatus.RUNNING, currentStyle: 'BE2250', dailyCapacity: 35, exportCapacity: 14 },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: '1', date: '2023-11-29', client: 'BGF', styleNo: 'BE3250', piNo: 'Z32025101631363', lineId: 1,
    blNo: '285753431', totalTons: 123, containers: 5, packagesPerContainer: 30, port: 'Incheon',
    contactPerson: 'Wang Fujing', tradeType: TradeType.GENERAL,
    requirements: '820KG Export Pack, Plywood Pallet, Film, Stock, Rail/Sea',
    status: OrderStatus.PENDING, isLargeOrder: true, largeOrderAck: true,
    loadingTimeSlot: LoadingTimeSlot.MORNING, expectedShipDate: '2023-11-29',
    workshopCommStatus: WorkshopCommStatus.CONFIRMED, prepDaysRequired: 2,
  },
  {
    id: '2', date: '2023-11-29', client: 'BAIKSAN LINTEX', styleNo: 'BE2250', piNo: '232025112232176', lineId: 3,
    blNo: '285753347', totalTons: 22.96, containers: 1, packagesPerContainer: 28, port: 'Busan',
    contactPerson: 'Wang Fujing', tradeType: TradeType.GENERAL,
    requirements: '820KG Export Pack, Plywood Pallet, Film, Stock, Premium',
    status: OrderStatus.CONFIRMED, isLargeOrder: false, largeOrderAck: false,
    loadingTimeSlot: LoadingTimeSlot.AFTERNOON, expectedShipDate: '2023-11-29',
    workshopCommStatus: WorkshopCommStatus.CONFIRMED, prepDaysRequired: 0,
  },
  {
    id: '3', date: '2023-11-29', client: 'PT FILAMENDO', styleNo: 'BE3340', piNo: 'Z32025093031198', lineId: 5,
    blNo: '177IKHKHS22941', totalTons: 209.92, containers: 8, packagesPerContainer: 32, port: 'Jakarta',
    contactPerson: 'TRACY', tradeType: TradeType.BONDED,
    requirements: '820KG Export Pack, Molded Pallet, Film, Stock, Manual #614, Rail/Sea',
    status: OrderStatus.CONFIRMED, isLargeOrder: true, largeOrderAck: false,
    loadingTimeSlot: LoadingTimeSlot.MORNING, expectedShipDate: '2023-11-30',
    workshopCommStatus: WorkshopCommStatus.IN_PROGRESS, workshopNote: '需提前与车间确认产能', prepDaysRequired: 3,
  }
];

export const INITIAL_INCIDENTS: IncidentLog[] = [];
