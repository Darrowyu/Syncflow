export interface InventoryItem {
  styleNo: string;
  currentStock: number;
  gradeA: number; // 优等品
  gradeB: number; // 一等品
  stockTMinus1: number;
  lockedForToday: number;
}

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT'
}

export enum InventoryGrade {
  A = 'A', // 优等品
  B = 'B'  // 一等品
}

export interface InventoryTransaction {
  id: number;
  styleNo: string;
  type: TransactionType;
  grade: InventoryGrade;
  quantity: number;
  balance: number;
  source?: string;
  note?: string;
  createdAt: string;
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
