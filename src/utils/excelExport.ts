import { Order, InventoryItem, ProductLine, IncidentLog } from '../types';
import * as XLSX from 'xlsx';

type ExportType = 'orders' | 'inventory' | 'lines' | 'incidents';

interface ExportConfig { filename: string; sheetName: string; columns: { key: string; header: string; width?: number }[] }

const configs: Record<ExportType, ExportConfig> = {
    orders: {
        filename: 'orders_export',
        sheetName: '订单列表',
        columns: [
            { key: 'date', header: '日期', width: 12 },
            { key: 'client', header: '客户', width: 20 },
            { key: 'styleNo', header: '款号', width: 12 },
            { key: 'piNo', header: 'PI号', width: 15 },
            { key: 'totalTons', header: '总量(t)', width: 10 },
            { key: 'containers', header: '柜数', width: 8 },
            { key: 'port', header: '港口', width: 15 },
            { key: 'status', header: '状态', width: 12 },
            { key: 'expectedShipDate', header: '预计发货', width: 12 },
            { key: 'contactPerson', header: '对接人', width: 12 },
        ],
    },
    inventory: {
        filename: 'inventory_export',
        sheetName: '库存列表',
        columns: [
            { key: 'styleNo', header: '款号', width: 12 },
            { key: 'currentStock', header: '当前库存(t)', width: 12 },
            { key: 'gradeA', header: '优等品(t)', width: 12 },
            { key: 'gradeB', header: '一等品(t)', width: 12 },
        ],
    },
    lines: {
        filename: 'lines_export',
        sheetName: '产线列表',
        columns: [
            { key: 'id', header: 'ID', width: 6 },
            { key: 'name', header: '产线名称', width: 15 },
            { key: 'status', header: '状态', width: 10 },
            { key: 'currentStyle', header: '当前款号', width: 12 },
            { key: 'dailyCapacity', header: '日产能(t)', width: 12 },
            { key: 'exportCapacity', header: '外贸可用(t)', width: 12 },
        ],
    },
    incidents: {
        filename: 'incidents_export',
        sheetName: '异常记录',
        columns: [
            { key: 'timestamp', header: '时间', width: 18 },
            { key: 'styleNo', header: '款号', width: 12 },
            { key: 'orderClient', header: '客户', width: 15 },
            { key: 'reportedBy', header: '上报人', width: 12 },
            { key: 'reason', header: '原因', width: 15 },
            { key: 'note', header: '备注', width: 30 },
            { key: 'resolved', header: '已解决', width: 8 },
        ],
    },
};

export function exportToExcel<T extends Record<string, any>>(data: T[], type: ExportType): void {
    const config = configs[type];
    const headers = config.columns.map(c => c.header);
    const rows = data.map(item => config.columns.map(c => {
        const val = item[c.key];
        if (typeof val === 'boolean') return val ? '是' : '否';
        return val ?? '';
    }));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = config.columns.map(c => ({ wch: c.width || 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    XLSX.writeFile(wb, `${config.filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportOrdersToExcel(orders: Order[]) { exportToExcel(orders, 'orders'); }
export function exportInventoryToExcel(inventory: InventoryItem[]) { exportToExcel(inventory, 'inventory'); }
export function exportLinesToExcel(lines: ProductLine[]) { exportToExcel(lines, 'lines'); }
export function exportIncidentsToExcel(incidents: IncidentLog[]) { exportToExcel(incidents, 'incidents'); }
