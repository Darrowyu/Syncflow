import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Package, Truck, Activity, AlertOctagon, Calendar, Clock, Zap } from 'lucide-react';
import { Order, InventoryItem, ProductLine, IncidentLog, LineStatus, LoadingTimeSlot, WorkshopCommStatus, OrderStatus } from '../../types';
import { useLanguage } from '../../i18n';
import { calculateChartData, calculateFulfillment, getPendingOrders, getCriticalAlerts, getUpcomingShipments, getTodayShipments } from '../../utils';
import { StatCard } from '../common';
import InventoryChart from './InventoryChart';

interface DashboardProps {
  orders: Order[];
  inventory: InventoryItem[];
  lines: ProductLine[];
  incidents: IncidentLog[];
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ orders, inventory, lines, incidents, onNavigate }) => {
  const { t } = useLanguage();
  const unresolvedIncidents = incidents.filter(i => !i.resolved);
  const pendingOrders = getPendingOrders(orders);
  const totalTonsPending = pendingOrders.reduce((sum, o) => sum + o.totalTons, 0);
  const activeLines = lines.filter(l => l.status === LineStatus.RUNNING);
  const criticalAlerts = getCriticalAlerts(orders);
  const chartData = calculateChartData(orders, inventory, lines);
  const todayShipments = getTodayShipments(orders);
  const upcomingShipments = getUpcomingShipments(orders);

  // 计算外贸总产能
  const totalExportCapacity = useMemo(() => activeLines.reduce((sum, l) => {
    if (l.subLines?.length) return sum + l.subLines.reduce((s, sub) => s + (sub.exportCapacity || 0), 0);
    return sum + (l.exportCapacity || 0);
  }, 0), [activeLines]);

  // 满足率预警订单（<100%且非已发货/齐料待发）
  const fulfillmentAlerts = useMemo(() => pendingOrders
    .filter(o => o.status !== OrderStatus.READY_TO_SHIP && o.status !== OrderStatus.SHIPPED)
    .map(o => ({ ...o, fulfillment: calculateFulfillment(o, inventory, lines, orders) }))
    .filter(o => o.fulfillment.percent < 100)
    .sort((a, b) => a.fulfillment.percent - b.fulfillment.percent)
    .slice(0, 5), [pendingOrders, inventory, lines, orders]);

  // 按产线分组订单统计
  const ordersByLine = useMemo(() => {
    const map = new Map<string, { count: number; tons: number }>();
    map.set('unassigned', { count: 0, tons: 0 });
    lines.forEach(l => map.set(l.name, { count: 0, tons: 0 }));
    pendingOrders.forEach(o => {
      const lineIds = o.lineIds ? o.lineIds.split(/[\/,]/).map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : (o.lineId ? [o.lineId] : []);
      if (lineIds.length === 0) {
        const v = map.get('unassigned')!; v.count++; v.tons += o.totalTons;
      } else {
        lineIds.forEach(id => {
          const line = lines.find(l => l.id === id);
          if (line) { const v = map.get(line.name)!; v.count++; v.tons += o.totalTons; }
        });
      }
    });
    return Array.from(map.entries()).filter(([, v]) => v.count > 0);
  }, [pendingOrders, lines]);

  const getLoadingTimeText = (slot?: LoadingTimeSlot): string => slot === LoadingTimeSlot.MORNING ? t('loading_morning') : slot === LoadingTimeSlot.AFTERNOON ? t('loading_afternoon') : t('loading_flexible');
  const getWsColor = (s?: WorkshopCommStatus): string => s === WorkshopCommStatus.CONFIRMED ? 'bg-green-100 text-green-700' : s === WorkshopCommStatus.IN_PROGRESS ? 'bg-yellow-100 text-yellow-700' : s === WorkshopCommStatus.ISSUE ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 统计卡片 - 增加外贸产能 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 md:gap-4">
        <StatCard icon={<Package size={20} />} iconBgClass="bg-blue-50 text-blue-600" label={t('stats_active_orders')} value={pendingOrders.length} />
        <StatCard icon={<Truck size={20} />} iconBgClass="bg-blue-50 text-blue-600" label={t('stats_pending_volume')} value={`${totalTonsPending.toFixed(1)}t`} />
        <StatCard icon={<CheckCircle size={20} />} iconBgClass="bg-green-50 text-green-600" label={t('stats_active_lines')} value={activeLines.length} suffix={`/${lines.length}`} />
        <StatCard icon={<Zap size={20} />} iconBgClass="bg-amber-50 text-amber-600" label={t('total_export_capacity')} value={`${totalExportCapacity.toFixed(1)}t`} />
        <StatCard icon={<AlertTriangle size={20} />} iconBgClass={criticalAlerts.length > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'} label={t('stats_critical_alerts')} value={criticalAlerts.length} valueClass={criticalAlerts.length > 0 ? 'text-red-600' : 'text-slate-800'} />
      </div>

      {/* 大单预警 */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-3 md:p-4 rounded-r-lg shadow-sm animate-pulse">
          <h4 className="flex items-center text-red-700 dark:text-red-400 font-semibold mb-2 text-sm md:text-base"><AlertTriangle size={16} className="mr-2" />{t('alert_large_order')}</h4>
          <div className="space-y-1">
            {criticalAlerts.map(order => (
              <div key={order.id} className="text-red-600 dark:text-red-300 text-xs md:text-sm flex flex-wrap items-center gap-1">
                <span className="font-bold">{order.client}</span><span>{order.totalTons}t</span><span className="font-mono bg-red-100 dark:bg-red-800 px-1 rounded">{order.styleNo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 产线状态面板 + 满足率预警 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 产线实时状态 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center"><Activity size={16} className="mr-2 text-green-500" />{t('line_status_panel')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {lines.map(line => {
              const isRunning = line.status === LineStatus.RUNNING;
              const isMaint = line.status === LineStatus.MAINTENANCE;
              return (
                <div key={line.id} onClick={() => onNavigate?.('Production')} className={`p-2.5 rounded-lg cursor-pointer transition hover:scale-[1.02] ${isRunning ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' : isMaint ? 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{line.name}</span>
                    <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : isMaint ? 'bg-yellow-500' : 'bg-slate-400'}`} />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{line.currentStyle || '-'}</div>
                  {isRunning && <div className="text-xs text-green-600 dark:text-green-400 mt-1">{line.exportCapacity || 0}t/日</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 满足率预警 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center"><AlertTriangle size={16} className="mr-2 text-amber-500" />{t('fulfillment_alerts')}</h3>
          {fulfillmentAlerts.length === 0 ? (
            <div className="text-center py-6 text-green-600 dark:text-green-400"><CheckCircle size={32} className="mx-auto mb-2" /><p className="text-sm">{t('all_fulfilled')}</p></div>
          ) : (
            <div className="space-y-2">
              {fulfillmentAlerts.map(order => (
                <div key={order.id} onClick={() => onNavigate?.('Orders')} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{order.client}</span>
                      <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${order.fulfillment.percent < 50 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{order.fulfillment.percent.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${order.fulfillment.percent < 50 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${order.fulfillment.percent}%` }} /></div>
                    <span className="text-xs text-slate-500">{order.totalTons}t</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 库存图表和健康度 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 order-2 lg:order-1"><InventoryChart data={chartData} /></div>
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 max-h-64 md:max-h-80 overflow-y-auto order-1 lg:order-2">
          <h3 className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center sticky top-0 bg-white dark:bg-slate-800 pb-2"><Activity size={16} className="mr-2 text-blue-500" />{t('inv_health')}</h3>
          <div className="space-y-3">
            {chartData.map((item) => {
              const isShortage = item.TotalAvailable < item.Demand;
              const gap = item.Demand - item.TotalAvailable;
              return (
                <div key={item.name} className="pb-2 border-b border-slate-50 dark:border-slate-700 last:border-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200 text-xs md:text-sm">{item.name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isShortage ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300' : 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'}`}>{isShortage ? `-${gap.toFixed(1)}t` : 'OK'}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1"><span>{Math.min(item.Coverage, 100).toFixed(0)}%</span><span>{item.TotalAvailable}/{item.Demand}t</span></div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5"><div className={`h-full rounded-full ${isShortage ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(item.Coverage, 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 产线订单分布 + 发货排程 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* 产线订单分布 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center"><Package size={16} className="mr-2 text-blue-500" />{t('orders_by_line')}</h3>
          <div className="space-y-2">
            {ordersByLine.map(([name, data]) => (
              <div key={name} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <span className="text-sm text-slate-700 dark:text-slate-200">{name === 'unassigned' ? t('no_line_assigned') : name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">{data.count}单</span>
                  <span className="text-xs font-mono text-slate-500">{data.tons.toFixed(1)}t</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 今日发货 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center"><Calendar size={16} className="mr-2 text-blue-500" />{t('today_shipments')}</h3>
          <div className="space-y-2">
            {todayShipments.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">{t('no_orders_load')}</p>}
            {todayShipments.map(order => (
              <div key={order.id} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{order.client}</span>
                      <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                      {order.isLargeOrder && <span className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded text-xs">{t('tag_large')}</span>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                      <span>{order.totalTons}t/{order.containers}柜</span>
                      <span className="flex items-center"><Clock size={10} className="mr-0.5" />{getLoadingTimeText(order.loadingTimeSlot)}</span>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${getWsColor(order.workshopCommStatus)}`}>{order.workshopCommStatus === WorkshopCommStatus.CONFIRMED ? '✓' : order.workshopCommStatus === WorkshopCommStatus.ISSUE ? '!' : '...'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 近期发货 */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center"><Truck size={16} className="mr-2 text-blue-500" />{t('upcoming_shipments')}</h3>
          <div className="space-y-2">
            {upcomingShipments.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">{t('no_orders_load')}</p>}
            {upcomingShipments.slice(0, 5).map(order => {
              const { percent } = calculateFulfillment(order, inventory, lines, orders);
              return (
                <div key={order.id} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{order.client}</span>
                      <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                    </div>
                    <span className="text-xs text-slate-400">{order.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${percent < 100 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                    <span className={`text-xs ${percent < 100 ? 'text-amber-600' : 'text-green-600'}`}>{percent.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 异常记录 */}
      <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center text-red-600 dark:text-red-400"><AlertOctagon size={16} className="mr-2" />{t('incident_recent')}</h3>
        <div className="md:hidden space-y-2">
          {unresolvedIncidents.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">{t('no_incidents')}</p>}
          {unresolvedIncidents.map((inc) => (
            <div key={inc.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">{inc.styleNo}</span>
                <span className="text-xs text-slate-400">{inc.timestamp}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{inc.orderClient || '-'}</div>
              <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">{t(`reason_${inc.reason}` as keyof typeof t) || inc.reason}</div>
              {inc.note && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{inc.note}</p>}
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400"><tr><th className="px-4 py-2">{t('table_date')}</th><th className="px-4 py-2">{t('table_style')}</th><th className="px-4 py-2">{t('table_client')}</th><th className="px-4 py-2">{t('label_reason')}</th><th className="px-4 py-2">{t('label_notes')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {unresolvedIncidents.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400 dark:text-slate-500">{t('no_incidents')}</td></tr>}
              {unresolvedIncidents.map((inc) => (<tr key={inc.id}><td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{inc.timestamp}</td><td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{inc.styleNo}</td><td className="px-4 py-3 text-slate-700 dark:text-slate-300">{inc.orderClient || '-'}</td><td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{t(`reason_${inc.reason}` as keyof typeof t) || inc.reason}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-md truncate">{inc.note}</td></tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
