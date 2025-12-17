import React from 'react';
import { Order, InventoryItem } from '../../types';
import { Printer, X } from 'lucide-react';

interface PrintPackingListProps {
    order: Order;
    inventory?: InventoryItem[];
    onClose: () => void;
}

const PrintPackingList: React.FC<PrintPackingListProps> = ({ order, inventory, onClose }) => {
    const stock = inventory?.find(i => i.styleNo === order.styleNo);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b no-print">
                    <h3 className="font-bold text-lg text-slate-800">装箱单预览</h3>
                    <div className="flex space-x-2">
                        <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Printer size={16} className="mr-2" />打印
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                </div>
                <div className="p-6 print-content" id="print-area">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-900">装 箱 单</h1>
                        <p className="text-sm text-slate-500 mt-1">PACKING LIST</p>
                    </div>
                    <table className="w-full border-collapse border border-slate-300 text-sm mb-4">
                        <tbody>
                            <tr>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium w-28">客户</td>
                                <td className="border border-slate-300 px-3 py-2">{order.client}</td>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium w-28">日期</td>
                                <td className="border border-slate-300 px-3 py-2">{order.date}</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">款号</td>
                                <td className="border border-slate-300 px-3 py-2 font-mono font-bold">{order.styleNo}</td>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">PI号</td>
                                <td className="border border-slate-300 px-3 py-2 font-mono">{order.piNo}</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">提单号</td>
                                <td className="border border-slate-300 px-3 py-2 font-mono">{order.blNo || '-'}</td>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">港口</td>
                                <td className="border border-slate-300 px-3 py-2">{order.port}</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">总重量</td>
                                <td className="border border-slate-300 px-3 py-2 font-bold text-lg">{order.totalTons} 吨</td>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">柜数</td>
                                <td className="border border-slate-300 px-3 py-2">{order.containers} 柜</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">包数/柜</td>
                                <td className="border border-slate-300 px-3 py-2">{order.packagesPerContainer} 包</td>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">总包数</td>
                                <td className="border border-slate-300 px-3 py-2 font-bold">{order.containers * order.packagesPerContainer} 包</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">贸易类型</td>
                                <td className="border border-slate-300 px-3 py-2">{order.tradeType}</td>
                                <td className="border border-slate-300 px-3 py-2 bg-slate-50 font-medium">对接人</td>
                                <td className="border border-slate-300 px-3 py-2">{order.contactPerson}</td>
                            </tr>
                        </tbody>
                    </table>
                    {order.requirements && (
                        <div className="border border-slate-300 p-3 mb-4">
                            <p className="text-xs text-slate-500 mb-1">装货要求</p>
                            <p className="text-sm">{order.requirements}</p>
                        </div>
                    )}
                    {stock && (
                        <div className="border border-slate-300 p-3 mb-4 bg-slate-50">
                            <p className="text-xs text-slate-500 mb-1">库存信息</p>
                            <p className="text-sm">当前库存: {stock.currentStock}t (优等品: {stock.gradeA}t / 一等品: {stock.gradeB}t)</p>
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-dashed border-slate-300">
                        <div className="text-center">
                            <p className="text-xs text-slate-500 mb-6">仓库签字</p>
                            <div className="border-b border-slate-400 mx-4"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-slate-500 mb-6">车间签字</p>
                            <div className="border-b border-slate-400 mx-4"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-slate-500 mb-6">日期</p>
                            <div className="border-b border-slate-400 mx-4"></div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20mm; }
          .no-print { display: none !important; }
        }
      `}</style>
        </div>
    );
};

export default PrintPackingList;
