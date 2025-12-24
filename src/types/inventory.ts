export enum WarehouseType {
  GENERAL = 'general', // 一般贸易库
  BONDED = 'bonded'    // 保税库
}

export enum PackageSpec {
  KG820 = '820kg',
  KG750 = '750kg',
  KG25 = '25kg'
}

export const PACKAGE_SPECS = [PackageSpec.KG820, PackageSpec.KG750, PackageSpec.KG25];

export interface InventoryItem {
  styleNo: string;
  warehouseType: WarehouseType;
  packageSpec: PackageSpec;
  currentStock: number;
  gradeA: number; // 优等品
  gradeB: number; // 一等品
  stockTMinus1: number;
  lockedForToday: number;
  safetyStock?: number; // 安全库存阈值
  lastUpdated?: string; // 最后更新时间
  lineId?: number; // 产线ID（可选，空表示总仓或历史数据）
  lineName?: string; // 产线名称（冗余存储，方便显示）
}

export interface InventoryAlert {
  styleNo: string;
  warehouseType: WarehouseType;
  packageSpec: PackageSpec;
  currentStock: number;
  lockedForToday?: number; // 锁定量
  available: number; // 可用库存（currentStock - lockedForToday）
  safetyStock: number;
  shortage: number; // 缺口数量（safetyStock - available）
}

export interface BatchInventoryItem {
  styleNo: string;
  warehouseType?: string;
  packageSpec?: string;
  quantity: number;
  grade?: string;
  source?: string;
  note?: string;
}

export interface InventoryAuditLog {
  id: number;
  styleNo: string;
  warehouseType: string;
  packageSpec: string;
  lineId?: number;
  lineName?: string;
  action: 'adjust' | 'lock' | 'unlock';
  beforeGradeA: number;
  beforeGradeB: number;
  afterGradeA: number;
  afterGradeB: number;
  reason: string;
  operator: string;
  createdAt: string;
}

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUST_IN = 'ADJUST_IN',   // 盘点调整入库
  ADJUST_OUT = 'ADJUST_OUT'  // 盘点调整出库
}

export enum InventoryGrade {
  A = 'A', // 优等品
  B = 'B'  // 一等品
}

export interface InventoryTransaction {
  id: number;
  styleNo: string;
  warehouseType: WarehouseType;
  packageSpec: PackageSpec;
  type: TransactionType;
  grade: InventoryGrade;
  quantity: number;
  balance: number;
  source?: string;
  note?: string;
  orderId?: string; // 关联订单ID
  createdAt: string;
}

export interface TransactionQueryParams {
  styleNo?: string;
  warehouseType?: string;
  packageSpec?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTransactions {
  data: InventoryTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IncidentLog {
  id: string;
  timestamp: string;
  styleNo: string;
  orderClient?: string;
  reportedBy: string;
  reason: string;
  note: string;
  resolved?: boolean;
  resolvedAt?: string;
}

export interface DashboardStats {
  totalOrders: number;
  totalTonsPending: number;
  linesRunning: number;
  criticalAlerts: number;
}
