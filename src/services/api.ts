import { Order, ProductLine, InventoryItem, IncidentLog, Style, InventoryTransaction, InventoryAlert, InventoryAuditLog, BatchInventoryItem, PaginatedTransactions, TransactionQueryParams } from '../types';
import { cacheGet, cacheSet, cacheClear } from '../utils/cache';

const API_PORT = import.meta.env.VITE_API_PORT;
const API_BASE = API_PORT ? `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api` : '/api';

// API响应类型
interface ApiSuccess { success: true }
interface ApiIdResponse { success: true; id: string | number }
interface InventoryBalanceResponse { success: true; balance: number; gradeA: number; gradeB: number }
interface BatchInventoryResponse { success: true; count: number; results: Array<{ styleNo: string; balance: number; gradeA: number; gradeB: number }>; errors?: Array<{ styleNo: string; error: string }> }
interface PaginatedAuditLogs { data: InventoryAuditLog[]; total: number; page: number; pageSize: number; totalPages: number }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `API Error: ${res.status}`);
  }
  return res.json();
}

// 带缓存的GET请求
async function cachedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached) return cached;
  const data = await fetcher();
  cacheSet(key, data);
  return data;
}

// 清除相关缓存
export const invalidateCache = (prefix?: string) => cacheClear(prefix);

// 库存
export const fetchInventory = () => cachedRequest('inventory', () => request<InventoryItem[]>('/inventory'));
export const updateInventory = (styleNo: string, data: Partial<InventoryItem> & { reason?: string; operator?: string }) => request<ApiSuccess>(`/inventory/${styleNo}`, { method: 'PUT', body: JSON.stringify(data) });
export const inventoryIn = (data: { styleNo: string; warehouseType?: string; packageSpec?: string; quantity: number; grade?: string; source?: string; note?: string; orderId?: string }) => request<InventoryBalanceResponse>('/inventory/in', { method: 'POST', body: JSON.stringify(data) });
export const inventoryOut = (data: { styleNo: string; warehouseType?: string; packageSpec?: string; quantity: number; grade?: string; source?: string; note?: string; orderId?: string }) => request<InventoryBalanceResponse>('/inventory/out', { method: 'POST', body: JSON.stringify(data) });
export const inventoryBatchIn = (items: BatchInventoryItem[]) => request<BatchInventoryResponse>('/inventory/batch-in', { method: 'POST', body: JSON.stringify({ items }) });
export const inventoryBatchOut = (items: BatchInventoryItem[]) => request<BatchInventoryResponse>('/inventory/batch-out', { method: 'POST', body: JSON.stringify({ items }) });
export const inventoryAdjust = (data: { styleNo: string; warehouseType?: string; packageSpec?: string; gradeA?: number; gradeB?: number; reason?: string; operator?: string }) => request<InventoryBalanceResponse>('/inventory/adjust', { method: 'POST', body: JSON.stringify(data) });
export const fetchInventoryAlerts = () => request<InventoryAlert[]>('/inventory/alerts');
export const setSafetyStock = (styleNo: string, data: { warehouseType?: string; packageSpec?: string; safetyStock: number }) => request<ApiSuccess>(`/inventory/${styleNo}/safety-stock`, { method: 'PUT', body: JSON.stringify(data) });
export const lockInventory = (styleNo: string, data: { warehouseType?: string; packageSpec?: string; quantity: number; reason?: string; operator?: string }) => request<{ success: true; locked: number }>(`/inventory/${styleNo}/lock`, { method: 'POST', body: JSON.stringify(data) });
export const unlockInventory = (styleNo: string, data: { warehouseType?: string; packageSpec?: string; quantity: number; reason?: string; operator?: string }) => request<{ success: true; locked: number }>(`/inventory/${styleNo}/unlock`, { method: 'POST', body: JSON.stringify(data) });
export const fetchInventoryTransactions = (params?: TransactionQueryParams) => {
  const searchParams = new URLSearchParams();
  if (params?.styleNo) searchParams.append('styleNo', params.styleNo);
  if (params?.warehouseType) searchParams.append('warehouseType', params.warehouseType);
  if (params?.packageSpec) searchParams.append('packageSpec', params.packageSpec);
  if (params?.type) searchParams.append('type', params.type);
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
  const query = searchParams.toString();
  return request<PaginatedTransactions>(`/inventory/transactions${query ? `?${query}` : ''}`);
};
export const fetchInventoryAuditLogs = (params?: { styleNo?: string; warehouseType?: string; packageSpec?: string; action?: string; page?: number; pageSize?: number }) => {
  const searchParams = new URLSearchParams();
  if (params?.styleNo) searchParams.append('styleNo', params.styleNo);
  if (params?.warehouseType) searchParams.append('warehouseType', params.warehouseType);
  if (params?.packageSpec) searchParams.append('packageSpec', params.packageSpec);
  if (params?.action) searchParams.append('action', params.action);
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
  const query = searchParams.toString();
  return request<PaginatedAuditLogs>(`/inventory/audit-logs${query ? `?${query}` : ''}`);
};
export const exportInventory = () => request<{ exportedAt: string; count: number; data: InventoryItem[] }>('/inventory/export');

// 产线
export const fetchLines = () => cachedRequest('lines', () => request<ProductLine[]>('/lines'));
export const createLine = (data: Partial<ProductLine>) => request<ApiIdResponse>('/lines', { method: 'POST', body: JSON.stringify(data) });
export const updateLine = (id: number, data: Partial<ProductLine> & { previousStyle?: string; subLineChanges?: { subName: string; fromStyle: string; toStyle: string }[]; changeTime?: string }) => request<ApiSuccess>(`/lines/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLine = (id: number) => request<ApiSuccess>(`/lines/${id}`, { method: 'DELETE' });

// 订单
export const fetchOrders = () => cachedRequest('orders', () => request<Order[]>('/orders'));
export const createOrder = (data: Order) => request<ApiIdResponse>('/orders', { method: 'POST', body: JSON.stringify(data) });
export const updateOrder = (id: string, data: Partial<Order>) => request<ApiSuccess>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const patchOrder = (id: string, data: Partial<Order>) => request<ApiSuccess>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteOrder = (id: string) => request<ApiSuccess>(`/orders/${id}`, { method: 'DELETE' });

// 款号
export const fetchStyles = () => cachedRequest('styles', () => request<Style[]>('/styles'));
export const createStyle = (data: Omit<Style, 'id'>) => request<ApiSuccess>('/styles', { method: 'POST', body: JSON.stringify(data) });
export const updateStyle = (id: number, data: Partial<Style>) => request<ApiSuccess>(`/styles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteStyle = (id: number) => request<ApiSuccess>(`/styles/${id}`, { method: 'DELETE' });

// 异常日志
export const fetchIncidents = () => cachedRequest('incidents', () => request<IncidentLog[]>('/incidents'));
export const createIncident = (data: IncidentLog) => request<ApiIdResponse>('/incidents', { method: 'POST', body: JSON.stringify(data) });
export const resolveIncident = (id: string, resolved: boolean) => request<ApiSuccess>(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ resolved }) });
export const deleteIncident = (id: string) => request<ApiSuccess>(`/incidents/${id}`, { method: 'DELETE' });

// 款号变更历史
interface StyleChangeLog { id: number; lineId: number; fromStyle: string; toStyle: string; changedAt: string }
export const fetchStyleLogs = (lineId?: number) => request<StyleChangeLog[]>(lineId ? `/style-logs/${lineId}` : '/style-logs');

// 数据备份与恢复
interface BackupData { version: string; exportedAt: string; orders: any[]; inventory: any[]; production_lines: any[]; styles: any[]; incidents: any[] }
interface RestoreResponse { success: true; message: string }
export const fetchBackup = () => request<BackupData>('/backup');
export const restoreBackup = (data: BackupData) => request<RestoreResponse>('/restore', { method: 'POST', body: JSON.stringify(data) });
export const downloadBackup = async () => {
  const data = await fetchBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `syncflow_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
