import { WarehouseType, PackageSpec } from './inventory';

// 库存流水记录
export interface InventoryTransactionDisplay {
    id: number;
    styleNo: string;
    warehouseType?: string;
    packageSpec?: string;
    type: string;
    grade?: string;
    quantity: number;
    balance: number;
    source?: string;
    note?: string;
    createdAt: string;
}

// 库存弹窗状态
export interface StockModalState {
    type: 'in' | 'out' | 'edit' | 'production';
    styleNo: string;
    warehouseType: string;
    packageSpec: string;
    lineId?: number;
    subLineId?: string;
    pendingQty?: number;
}

// 库存表单
export interface StockForm {
    quantity: number;
    grade: string;
    gradeA: number;
    gradeB: number;
    source: string;
    note: string;
    warehouseType: WarehouseType;
    packageSpec: PackageSpec;
}

// 锁定弹窗状态
export interface LockModalState {
    styleNo: string;
    warehouseType: string;
    packageSpec: string;
    currentLocked: number;
    currentStock: number;
}

// 锁定表单
export interface LockForm {
    quantity: number;
    reason: string;
}

// 安全库存弹窗状态
export interface SafetyModalState {
    styleNo: string;
    warehouseType: string;
    packageSpec: string;
    currentSafety: number;
}

// 待入库项
export interface PendingProductionItem {
    lineId: number;
    lineName: string;
    subLineId?: string;
    subLineName?: string;
    styleNo: string;
    quantity: number;
}
