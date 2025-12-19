import React, { useRef, memo, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Order, InventoryItem, ProductLine, OrderStatus, TradeType, LoadingTimeSlot } from '../../types';
import { AlertCircle, ChevronDown, ChevronUp, Edit2, Trash2, Printer } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { calculateFulfillment } from '../../utils';

interface OrderTableProps {
  orders: Order[];
  allOrders?: Order[]; // 所有订单（用于计算其他订单占用）
  inventory: InventoryItem[];
  lines: ProductLine[];
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  onUpdateStatus: (id: string, status: OrderStatus, percent: number) => void;
  onAcknowledgeOrder: (id: string) => void;
  onEdit: (order: Order) => void;
  onDelete: (id: string) => void;
  onPrint: (order: Order) => void;
}

const getStatusColor = (s: OrderStatus) => { // 移到组件外避免重复创建
  switch (s) {
    case OrderStatus.IN_PRODUCTION: return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case OrderStatus.READY_TO_SHIP: return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case OrderStatus.SHIPPED: return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
    case OrderStatus.CONFIRMED: return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    default: return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  }
};

const ROW_HEIGHT = 56; // 行高常量
const EXPANDED_HEIGHT = 160; // 展开行高度

const OrderTable: React.FC<OrderTableProps> = memo(({ orders, allOrders, inventory, lines, expandedId, onToggleExpand, onUpdateStatus, onAcknowledgeOrder, onEdit, onDelete, onPrint }) => {
  const { t } = useLanguage();
  const parentRef = useRef<HTMLDivElement>(null);

  const getTimeText = useCallback((s?: LoadingTimeSlot) => s === LoadingTimeSlot.MORNING ? t('loading_morning') : s === LoadingTimeSlot.AFTERNOON ? t('loading_afternoon') : t('loading_flexible'), [t]);

  // 计算每行高度（展开行需要更高）
  const getItemSize = useCallback((index: number) => {
    const order = orders[index];
    return expandedId === order?.id ? ROW_HEIGHT + EXPANDED_HEIGHT : ROW_HEIGHT;
  }, [orders, expandedId]);

  const rowVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => orders[index]?.id || index,
    overscan: 5,
  });

  // 预计算满足率，避免渲染时重复计算
  const fulfillmentMap = useMemo(() => {
    const map = new Map<string, { percent: number; isShortage: boolean }>();
    const ordersForCalc = allOrders || orders; // 优先使用allOrders计算占用
    orders.forEach(order => map.set(order.id, calculateFulfillment(order, inventory, lines, ordersForCalc)));
    return map;
  }, [orders, allOrders, inventory, lines]);

  // 合计数据
  const totals = useMemo(() => ({
    tons: orders.reduce((sum, o) => sum + o.totalTons, 0),
    containers: orders.reduce((sum, o) => sum + o.containers, 0),
  }), [orders]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto bg-white dark:bg-slate-800">
        <div style={{ minWidth: '1000px' }}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left">{t('table_date')}</th>
                <th className="px-3 py-3 text-left">{t('table_client')}</th>
                <th className="px-3 py-3 text-left">{t('table_style')}</th>
                <th className="px-3 py-3 text-right">{t('table_total')}</th>
                <th className="px-3 py-3 text-center">{t('table_containers')}</th>
                <th className="px-3 py-3 text-left">{t('table_port')}</th>
                <th className="px-3 py-3 text-left">{t('workshop_status')}</th>
                <th className="px-3 py-3 text-left">{t('table_fulfillment')}</th>
                <th className="px-3 py-3 text-center">{t('table_actions')}</th>
              </tr>
            </thead>
          </table>
          <div ref={parentRef} className="max-h-[600px] overflow-y-auto">
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              <table className="w-full text-sm" style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
                <tbody>
                  {virtualItems.map((virtualRow) => {
                    const order = orders[virtualRow.index];
                    if (!order) return null;
                    const { percent, isShortage } = fulfillmentMap.get(order.id) || { percent: 0, isShortage: true };
                    const isUrgent = order.isLargeOrder && !order.largeOrderAck;
                    const isExpanded = expandedId === order.id;
                    return (
                      <React.Fragment key={order.id}>
                        <tr
                          className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700"
                          onClick={() => onToggleExpand(isExpanded ? null : order.id)}
                          style={{ height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)`, position: 'absolute', top: 0, left: 0, width: '100%', display: 'table', tableLayout: 'fixed' }}
                        >
                          <td className="px-3 py-3 text-slate-400 dark:text-slate-500 w-8">{virtualRow.index + 1}</td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{order.date}</td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{order.client}</div>
                            {order.isLargeOrder && <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-1 rounded">{t('tag_large')}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                            {(order.lineIds || order.lineId) && <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{order.lineIds || order.lineId}{t('line_suffix')}</span>}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-medium text-slate-800 dark:text-slate-100">{order.totalTons.toFixed(2)}</td>
                          <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">{order.containers}</td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{order.port}</td>
                          <td className="px-3 py-3">
                            <select value={order.status} onChange={(e) => { e.stopPropagation(); onUpdateStatus(order.id, e.target.value as OrderStatus, percent); }} onClick={(e) => e.stopPropagation()} className={`px-2 py-0.5 rounded text-xs border-none cursor-pointer ${getStatusColor(order.status)}`}>
                              <option value={OrderStatus.PENDING}>{t('status_pending')}</option>
                              <option value={OrderStatus.IN_PRODUCTION}>{t('status_in_production')}</option>
                              <option value={OrderStatus.READY_TO_SHIP} disabled={percent < 100}>{t('status_ready_to_ship')}</option>
                              <option value={OrderStatus.SHIPPED} disabled={percent < 100}>{t('status_shipped')}</option>
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2"><div className={`h-2 rounded-full ${isShortage ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                              <span className={`text-xs ${isShortage ? 'text-red-500 font-bold' : 'text-green-600 dark:text-green-400'}`}>{percent.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {isUrgent && <button onClick={(e) => { e.stopPropagation(); onAcknowledgeOrder(order.id); }} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold animate-pulse inline-flex items-center"><AlertCircle size={10} className="mr-0.5" />{t('btn_ack_large')}</button>}
                              <button onClick={(e) => { e.stopPropagation(); onPrint(order); }} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" title={t('print_packing_list')}><Printer size={14} /></button>
                              {order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.READY_TO_SHIP && <button onClick={(e) => { e.stopPropagation(); onEdit(order); }} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"><Edit2 size={14} /></button>}
                              {order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.READY_TO_SHIP && <button onClick={(e) => { e.stopPropagation(); onDelete(order.id); }} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
                              {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr
                            className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700"
                            style={{ height: EXPANDED_HEIGHT, transform: `translateY(${virtualRow.start + ROW_HEIGHT}px)`, position: 'absolute', top: 0, left: 0, width: '100%', display: 'table', tableLayout: 'fixed' }}
                          >
                            <td colSpan={10} className="px-6 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                                <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_po')}</span><span className="font-mono text-slate-700 dark:text-slate-300">{order.piNo}</span></div>
                                <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_bl')}</span><span className="font-mono text-slate-700 dark:text-slate-300">{order.blNo || '-'}</span></div>
                                <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_pkg_per_cont')}</span><span className="text-slate-700 dark:text-slate-300">{order.packagesPerContainer}</span></div>
                                <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_contact')}</span><span className="bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs">{order.contactPerson}</span></div>
                                <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_trade_type')}</span><span className={`px-2 py-0.5 rounded text-xs ${order.tradeType === TradeType.BONDED ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{order.tradeType === TradeType.BONDED ? t('trade_bonded') : t('trade_general')}</span></div>
                                <div><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('loading_time')}</span><span className="text-slate-700 dark:text-slate-300">{getTimeText(order.loadingTimeSlot)}</span></div>
                                <div className="col-span-2 md:col-span-4 lg:col-span-6"><span className="text-slate-400 dark:text-slate-500 text-xs block">{t('table_requirements')}</span><span className="text-slate-700 dark:text-slate-300">{order.requirements}</span></div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* 合计行 - 独立于滚动区域 */}
      <div className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-600 px-3 py-3 flex items-center justify-between">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{t('total_summary')} ({orders.length} {t('order_unit')})</span>
        <div className="flex items-center space-x-8">
          <div className="text-right">
            <span className="text-xs text-slate-400 dark:text-slate-500 block">{t('table_total')}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{totals.tons.toFixed(2)}</span>
          </div>
          <div className="text-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 block">{t('table_containers')}</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{totals.containers}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

OrderTable.displayName = 'OrderTable';

export default OrderTable;
