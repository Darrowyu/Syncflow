import { Order, InventoryItem, ProductLine, IncidentLog, WarehouseType } from '../types';
import ExcelJS from 'exceljs';

type ExportType = 'orders' | 'inventory' | 'lines' | 'incidents';

interface ColConfig { key: string; header: string; width: number; align?: 'left' | 'center'; transform?: (val: unknown, item: Record<string, unknown>) => string }
interface ExportConfig { filename: string; sheetName: string; columns: ColConfig[] }

const whMap: Record<string, string> = { [WarehouseType.GENERAL]: '一般贸易库', [WarehouseType.BONDED]: '保税库' };

const configs: Record<ExportType, ExportConfig> = {
  orders: {
    filename: 'orders_export', sheetName: '订单列表',
    columns: [
      { key: '_seq', header: '序号', width: 8 },
      { key: 'date', header: '日期', width: 12 },
      { key: 'client', header: '客户', width: 22, align: 'left' },
      { key: 'styleNo', header: '款号', width: 14, align: 'left' },
      { key: 'piNo', header: 'PI号', width: 20, align: 'left' },
      { key: 'lineIds', header: '产线', width: 10, transform: (v, item) => String(v || item.lineId || '') },
      { key: 'blNo', header: '提单号', width: 22, align: 'left' },
      { key: 'totalTons', header: '总量(t)', width: 12 },
      { key: 'containers', header: '柜数', width: 10 },
      { key: 'packagesPerContainer', header: '包/柜', width: 10 },
      { key: 'port', header: '港口', width: 14 },
      { key: 'contactPerson', header: '对接人', width: 12 },
      { key: 'tradeType', header: '贸易类型', width: 12, transform: (v) => v === 'Bonded' ? '保税' : '一般贸易' },
      { key: 'requirements', header: '装货要求', width: 35, align: 'left' },
    ],
  },
  inventory: {
    filename: 'inventory_export', sheetName: '库存列表',
    columns: [
      { key: 'styleNo', header: '款号', width: 14 },
      { key: 'lineName', header: '产线', width: 12, transform: (v) => String(v || '-') },
      { key: 'warehouseType', header: '仓库类型', width: 14, transform: (v) => whMap[String(v)] || String(v) },
      { key: 'packageSpec', header: '包装规格', width: 12 },
      { key: 'gradeA', header: '优等品(t)', width: 12 },
      { key: 'gradeB', header: '一等品(t)', width: 12 },
      { key: 'currentStock', header: '总库存(t)', width: 12 },
      { key: 'lockedForToday', header: '已锁定(t)', width: 12 },
      { key: 'safetyStock', header: '安全库存(t)', width: 14 },
    ],
  },
  lines: {
    filename: 'lines_export', sheetName: '产线列表',
    columns: [
      { key: 'id', header: 'ID', width: 8 },
      { key: 'name', header: '产线名称', width: 16 },
      { key: 'status', header: '状态', width: 12 },
      { key: 'currentStyle', header: '当前款号', width: 14 },
      { key: 'dailyCapacity', header: '日产能(t)', width: 12 },
      { key: 'exportCapacity', header: '外贸可用(t)', width: 14 },
    ],
  },
  incidents: {
    filename: 'incidents_export', sheetName: '异常记录',
    columns: [
      { key: 'timestamp', header: '时间', width: 20 },
      { key: 'styleNo', header: '款号', width: 14 },
      { key: 'orderClient', header: '客户', width: 16 },
      { key: 'reportedBy', header: '上报人', width: 12 },
      { key: 'reason', header: '原因', width: 16 },
      { key: 'note', header: '备注', width: 32 },
      { key: 'resolved', header: '已解决', width: 10 },
    ],
  },
};

export async function exportToExcel<T extends object>(data: T[], type: ExportType): Promise<void> {
  const config = configs[type];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(config.sheetName);

  ws.columns = config.columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

  data.forEach((item, idx) => {
    const row: Record<string, unknown> = {};
    config.columns.forEach(c => {
      if (c.key === '_seq') { row[c.key] = idx + 1; return; }
      const val = (item as Record<string, unknown>)[c.key];
      row[c.key] = c.transform ? c.transform(val, item as Record<string, unknown>) : (typeof val === 'boolean' ? (val ? '是' : '否') : (val ?? ''));
    });
    ws.addRow(row);
  });

  const leftCols = new Set(config.columns.filter(c => c.align === 'left').map(c => c.key)); // 左对齐列
  ws.eachRow((row, rowNum) => {
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 11, bold: rowNum === 1 };
      const colKey = config.columns[colNum - 1]?.key;
      cell.alignment = { horizontal: rowNum === 1 ? 'center' : (leftCols.has(colKey) ? 'left' : 'center'), vertical: 'middle' };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${config.filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportOrdersToExcel(orders: Order[]): Promise<void> { // 订单专用导出（含标题行和合计行）
  const config = configs.orders;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(config.sheetName);

  ws.columns = config.columns.map(c => ({ key: c.key, width: c.width }));

  // 1. 首行：标题（日期 + 海运装柜）
  const shipDate = orders.length > 0 ? orders[0].date : new Date().toISOString().split('T')[0];
  const titleRow = ws.addRow([`${shipDate} 海运装柜`]);
  ws.mergeCells(1, 1, 1, config.columns.length); // 合并首行所有列
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFF0000' } };

  // 2. 第二行：表头
  const headerRow = ws.addRow(config.columns.map(c => c.header));
  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // 3. 数据行
  const leftCols = new Set(config.columns.filter(c => c.align === 'left').map(c => c.key));
  orders.forEach((order, idx) => {
    const rowData = config.columns.map(c => {
      if (c.key === '_seq') return idx + 1;
      const val = (order as unknown as Record<string, unknown>)[c.key];
      return c.transform ? c.transform(val, order as unknown as Record<string, unknown>) : (typeof val === 'boolean' ? (val ? '是' : '否') : (val ?? ''));
    });
    const dataRow = ws.addRow(rowData);
    dataRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 11 };
      const colKey = config.columns[colNum - 1]?.key;
      cell.alignment = { horizontal: leftCols.has(colKey) ? 'left' : 'center', vertical: 'middle' };
    });
  });

  // 4. 合计行
  const totalTons = orders.reduce((sum, o) => sum + (o.totalTons || 0), 0);
  const totalContainers = orders.reduce((sum, o) => sum + (o.containers || 0), 0);
  const summaryRowData = config.columns.map(c => {
    if (c.key === '_seq') return '合计';
    if (c.key === 'totalTons') return totalTons.toFixed(2);
    if (c.key === 'containers') return totalContainers;
    return '';
  });
  const summaryRow = ws.addRow(summaryRowData);
  summaryRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders_export_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportInventoryToExcel = (inventory: InventoryItem[]) => exportToExcel(inventory, 'inventory');
export const exportLinesToExcel = (lines: ProductLine[]) => exportToExcel(lines, 'lines');
export const exportIncidentsToExcel = (incidents: IncidentLog[]) => exportToExcel(incidents, 'incidents');
