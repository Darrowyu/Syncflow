import React from 'react';
import { AlertTriangle, CheckCircle, Package, Truck, Activity, AlertOctagon, Calendar, Clock } from 'lucide-react';
import { Order, InventoryItem, ProductLine, IncidentLog, LineStatus, LoadingTimeSlot, WorkshopCommStatus } from '../../types';
import { useLanguage } from '../../i18n';
import { calculateChartData, getPendingOrders, getCriticalAlerts, getUpcomingShipments, getTodayShipments } from '../../utils';
import { StatCard } from '../common';
import InventoryChart from './InventoryChart';

interface DashboardProps {
  orders: Order[];
  inventory: InventoryItem[];
  lines: ProductLine[];
  incidents: IncidentLog[];
}

const Dashboard: React.FC<DashboardProps> = ({ orders, inventory, lines, incidents }) => {
  const unresolvedIncidents = incidents.filter(i => !i.resolved);
  const { t, language } = useLanguage();
  const pendingOrders = getPendingOrders(orders);
  const totalTonsPending = pendingOrders.reduce((sum, o) => sum + o.totalTons, 0);
  const activeLines = lines.filter(l => l.status === LineStatus.RUNNING).length;
  const criticalAlerts = getCriticalAlerts(orders);
  const chartData = calculateChartData(orders, inventory, lines);
  const todayShipments = getTodayShipments(orders);
  const upcomingShipments = getUpcomingShipments(orders);
  const getLoadingTimeText = (slot?: LoadingTimeSlot) => {
    switch (slot) {
      case LoadingTimeSlot.MORNING: return t('loading_morning');
      case LoadingTimeSlot.AFTERNOON: return t('loading_afternoon');
      default: return t('loading_flexible');
    }
  };

  const getWorkshopStatusColor = (status?: WorkshopCommStatus) => {
    switch (status) {
      case WorkshopCommStatus.CONFIRMED: return 'bg-green-100 text-green-700';
      case WorkshopCommStatus.IN_PROGRESS: return 'bg-yellow-100 text-yellow-700';
      case WorkshopCommStatus.ISSUE: return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 统计卡片 - 移动端2列，桌面端4列 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <StatCard icon={<Package size={20} />} iconBgClass="bg-blue-50 text-blue-600" label={t('stats_active_orders')} value={pendingOrders.length} />
        <StatCard icon={<Truck size={20} />} iconBgClass="bg-blue-50 text-blue-600" label={t('stats_pending_volume')} value={`${totalTonsPending.toFixed(1)}t`} />
        <StatCard icon={<CheckCircle size={20} />} iconBgClass="bg-green-50 text-green-600" label={t('stats_active_lines')} value={activeLines} suffix={`/${lines.length}`} />
        <StatCard icon={<AlertTriangle size={20} />} iconBgClass={criticalAlerts.length > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'} label={t('stats_critical_alerts')} value={criticalAlerts.length} valueClass={criticalAlerts.length > 0 ? 'text-red-600' : 'text-slate-800'} />
      </div>

      {/* 大单预警 */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-3 md:p-4 rounded-r-lg shadow-sm animate-pulse">
          <h4 className="flex items-center text-red-700 dark:text-red-400 font-semibold mb-2 text-sm md:text-base"><AlertTriangle size={16} className="mr-2 flex-shrink-0" />{t('alert_large_order')}</h4>
          <div className="space-y-1">
            {criticalAlerts.map(order => (
              <div key={order.id} className="text-red-600 dark:text-red-300 text-xs md:text-sm flex flex-wrap items-center gap-1">
                <span className="font-bold">{order.client}</span>
                <span>{order.totalTons}t</span>
                <span className="font-mono bg-red-100 dark:bg-red-800 px-1 rounded">{order.styleNo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 库存图表和健康度 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 order-2 lg:order-1">
          <InventoryChart data={chartData} />
        </div>
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

      {/* 发货排程看板 - 移动端卡片式 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center"><Calendar size={16} className="mr-2 text-blue-500" />{t('today_shipments')}</h3>
          <div className="space-y-2 md:space-y-3">
            {todayShipments.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">{t('no_orders_load')}</p>}
            {todayShipments.map(order => (
              <div key={order.id} className="p-2.5 md:p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 md:gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{order.client}</span>
                      <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                      {order.isLargeOrder && <span className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded text-xs">{t('tag_large')}</span>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>{order.totalTons}t/{order.containers}柜</span>
                      <span className="flex items-center"><Clock size={10} className="mr-0.5" />{getLoadingTimeText(order.loadingTimeSlot)}</span>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ml-2 ${getWorkshopStatusColor(order.workshopCommStatus)}`}>
                    {order.workshopCommStatus === WorkshopCommStatus.CONFIRMED ? '✓' : order.workshopCommStatus === WorkshopCommStatus.ISSUE ? '!' : '...'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center"><Truck size={16} className="mr-2 text-blue-500" />{t('upcoming_shipments')}</h3>
          <div className="space-y-2 md:space-y-3">
            {upcomingShipments.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">{t('no_orders_load')}</p>}
            {upcomingShipments.map(order => (
              <div key={order.id} className="p-2.5 md:p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 md:gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{order.client}</span>
                      <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{order.expectedShipDate} · {order.totalTons}t</div>
                  </div>
                  {order.prepDaysRequired && order.prepDaysRequired > 0 && (
                    <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded text-xs flex-shrink-0 ml-2">{order.prepDaysRequired}{t('days')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 异常记录 - 移动端卡片式，桌面端表格 */}
      <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 md:mb-4 flex items-center text-red-600 dark:text-red-400"><AlertOctagon size={16} className="mr-2" />{t('incident_recent')}</h3>
        {/* 移动端卡片视图 */}
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
        {/* 桌面端表格视图 */}
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
