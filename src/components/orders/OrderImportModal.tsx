import React, { useState } from 'react';
import { Order, TradeType } from '../../types';
import { Loader2, FileSpreadsheet, Upload } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { Modal } from '../common';
import ExcelJS from 'exceljs';

interface OrderImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (orders: Partial<Order>[]) => Promise<void>;
}

// Excel粘贴解析：日期 客户 款号 PI号 产线 提单号 总量 柜数 包/柜 港口 对接人 贸易类型 装货要求
const parseExcelData = (text: string): Partial<Order>[] => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const orders: Partial<Order>[] = [];
    for (const line of lines) {
        const cols = line.split('\t');
        if (cols.length < 4) continue;
        const [date, client, styleNo, piNo, lineId, blNo, totalTons, containers, pkgPerCont, port, contact, tradeType, requirements] = cols;
        if (!client || !styleNo || !totalTons) continue;
        const tons = parseFloat(totalTons) || 0;
        orders.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            date: date || new Date().toISOString().split('T')[0],
            client: client.trim(),
            styleNo: styleNo.trim(),
            piNo: piNo?.trim() || '',
            lineId: lineId && !String(lineId).includes('/') && !String(lineId).includes(',') ? parseInt(lineId) : undefined,
            lineIds: lineId && (String(lineId).includes('/') || String(lineId).includes(',')) ? String(lineId).trim() : undefined,
            blNo: blNo?.trim() || '',
            totalTons: tons,
            containers: parseInt(containers) || 1,
            packagesPerContainer: parseInt(pkgPerCont) || 30,
            port: port?.trim() || '',
            contactPerson: contact?.trim() || '',
            tradeType: tradeType?.includes('保税') ? TradeType.BONDED : TradeType.GENERAL,
            requirements: requirements?.trim() || '',
            status: 'Pending' as any,
            isLargeOrder: tons > 100,
            largeOrderAck: false,
        });
    }
    return orders;
};

const OrderImportModal: React.FC<OrderImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [importMode, setImportMode] = useState<'paste' | 'file'>('paste');
    const [excelInput, setExcelInput] = useState('');
    const [excelPreview, setExcelPreview] = useState<Partial<Order>[]>([]);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const { t } = useLanguage();

    const handleExcelParse = () => { setExcelPreview(parseExcelData(excelInput)); };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsLoadingFile(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const sheet = workbook.worksheets[0];
            const rows: unknown[][] = [];
            sheet.eachRow((row) => rows.push(row.values as unknown[]));
            const orders: Partial<Order>[] = [];
            for (let i = 2; i < rows.length; i++) { // exceljs索引从1开始
                const cols = rows[i] as unknown[];
                if (!cols || cols.length < 5) continue;
                // exceljs的row.values索引从1开始：[1]序号 [2]日期 [3]客户 [4]款号...
                const [, , date, client, styleNo, piNo, lineId, blNo, totalTons, containers, pkgPerCont, port, contact, tradeType, requirements] = cols;
                if (!client || !styleNo) continue;
                const tons = parseFloat(String(totalTons)) || 0;
                orders.push({
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i,
                    date: date ? String(date) : new Date().toISOString().split('T')[0],
                    client: String(client).trim(),
                    styleNo: String(styleNo).trim(),
                    piNo: piNo ? String(piNo).trim() : '',
                    lineId: lineId && !String(lineId).includes('/') && !String(lineId).includes(',') ? parseInt(String(lineId)) : undefined,
                    lineIds: lineId && (String(lineId).includes('/') || String(lineId).includes(',')) ? String(lineId).trim() : undefined,
                    blNo: blNo ? String(blNo).trim() : '',
                    totalTons: tons,
                    containers: parseInt(String(containers)) || 1,
                    packagesPerContainer: parseInt(String(pkgPerCont)) || 30,
                    port: port ? String(port).trim() : '',
                    contactPerson: contact ? String(contact).trim() : '',
                    tradeType: tradeType && String(tradeType).includes('保税') ? TradeType.BONDED : TradeType.GENERAL,
                    requirements: requirements ? String(requirements).trim() : '',
                    status: 'Pending' as any,
                    isLargeOrder: tons > 100,
                    largeOrderAck: false,
                });
            }
            setExcelPreview(orders);
        } catch { alert(t('alert_excel_fail')); }
        finally { setIsLoadingFile(false); e.target.value = ''; }
    };

    const handleImport = async () => {
        if (excelPreview.length === 0) return;
        setIsImporting(true);
        try {
            await onImport(excelPreview);
            handleClose();
        } finally { setIsImporting(false); }
    };

    const handleClose = () => { setExcelInput(''); setExcelPreview([]); setImportMode('paste'); onClose(); };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={t('import_title')} titleIcon={<Upload size={20} />}>
            <div className="space-y-4">
                <div className="flex space-x-2 mb-2">
                    <button onClick={() => setImportMode('paste')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${importMode === 'paste' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{t('paste_data')}</button>
                    <button onClick={() => setImportMode('file')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${importMode === 'file' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{t('upload_file')}</button>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">{importMode === 'paste' ? t('paste_hint') : t('upload_hint')}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{t('column_order')}</p>
                </div>
                {importMode === 'paste' ? (
                    <>
                        <textarea className="w-full h-32 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none" placeholder="从Excel粘贴数据..." value={excelInput} onChange={(e) => setExcelInput(e.target.value)} />
                        <button onClick={handleExcelParse} disabled={!excelInput.trim()} className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">{t('parse_preview')}</button>
                    </>
                ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                        {isLoadingFile ? <Loader2 className="animate-spin text-green-600 dark:text-green-400" size={32} /> : <><FileSpreadsheet size={32} className="text-slate-400 mb-2" /><span className="text-sm text-slate-500 dark:text-slate-400">点击选择Excel文件 (.xlsx)</span></>}
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                    </label>
                )}
                {excelPreview.length > 0 && (
                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">{t('preview_count')} ({excelPreview.length})</div>
                        <div className="max-h-40 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"><tr><th className="px-2 py-1 text-left">日期</th><th className="px-2 py-1 text-left">客户</th><th className="px-2 py-1 text-left">款号</th><th className="px-2 py-1 text-right">吨数</th><th className="px-2 py-1 text-center">柜数</th></tr></thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                    {excelPreview.map((o, i) => <tr key={i}><td className="px-2 py-1">{o.date}</td><td className="px-2 py-1">{o.client}</td><td className="px-2 py-1 font-mono">{o.styleNo}</td><td className="px-2 py-1 text-right">{o.totalTons}</td><td className="px-2 py-1 text-center">{o.containers}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                <button onClick={handleImport} disabled={excelPreview.length === 0 || isImporting} className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">{isImporting ? '导入中...' : t('confirm_import')} {excelPreview.length > 0 && `(${excelPreview.length})`}</button>
            </div>
        </Modal>
    );
};

export default OrderImportModal;
