export enum OrderStatus {
  PENDING = 'Pending',
  IN_PRODUCTION = 'InProduction',
  READY_TO_SHIP = 'ReadyToShip',
  CONFIRMED = 'Confirmed',
  SHIPPED = 'Shipped',
  DELAYED = 'Delayed',
}

export enum TradeType {
  GENERAL = 'General Trade',
  BONDED = 'Bonded',
}

export enum LoadingTimeSlot {
  MORNING = 'Morning',
  AFTERNOON = 'Afternoon',
  FLEXIBLE = 'Flexible',
}

export enum WorkshopCommStatus {
  NOT_STARTED = 'NotStarted',
  IN_PROGRESS = 'InProgress',
  CONFIRMED = 'Confirmed',
  ISSUE = 'Issue',
}

import { PackageSpec } from './inventory';

export interface WarehouseAllocation { // 仓库分配
  general: number; // 一般贸易库分配量
  bonded: number; // 保税库分配量
}

export interface Order {
  id: string;
  date: string;
  client: string;
  styleNo: string;
  packageSpec?: PackageSpec; // 包装规格（可选，后续可补充）
  piNo: string;
  lineId?: number;
  lineIds?: string; // 多产线：如 "1/2" 或 "1,2,3"
  blNo?: string;
  totalTons: number;
  containers: number;
  packagesPerContainer: number;
  port: string;
  contactPerson: string;
  tradeType: TradeType;
  requirements: string;
  status: OrderStatus;
  isLargeOrder: boolean;
  largeOrderAck: boolean;
  loadingTimeSlot?: LoadingTimeSlot; // 装货时间段
  expectedShipDate?: string; // 预计发货日期
  workshopCommStatus?: WorkshopCommStatus; // 车间沟通状态
  workshopNote?: string; // 车间沟通备注
  prepDaysRequired?: number; // 大货需提前备货天数
  warehouseAllocation?: WarehouseAllocation; // 仓库分配（可选，未设置则按tradeType默认）
}
