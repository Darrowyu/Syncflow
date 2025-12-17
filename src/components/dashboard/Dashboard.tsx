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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Package size={24} />} iconBgClass="bg-blue-50 text-blue-600" label={t('stats_active_orders')} value={pendingOrders.length} />
        <StatCard icon={<Truck size={24} />} iconBgClass="bg-indigo-50 text-indigo-600" label={t('stats_pending_volume')} value={`${totalTonsPending.toFixed(2)}t`} />
        <StatCard icon={<CheckCircle size={24} />} iconBgClass="bg-green-50 text-green-600" label={t('stats_active_lines')} value={activeLines} suffix={`/ ${lines.length}`} />
        <StatCard icon={<AlertTriangle size={24} />} iconBgClass={criticalAlerts.length > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'} label={t('stats_critical_alerts')} value={criticalAlerts.length} valueClass={criticalAlerts.length > 0 ? 'text-red-600' : 'text-slate-800'} />
      </div>

      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm animate-pulse">
          <h4 className="flex items-center text-red-700 dark:text-red-400 font-semibold mb-2"><AlertTriangle size={18} className="mr-2" />{t('alert_large_order')}</h4>
          <ul className="list-disc list-inside space-y-1">
            {criticalAlerts.map(order => (
              <li key={order.id} className="text-red-600 dark:text-red-300 text-sm"><span className="font-bold">{order.client}</span> {t('requires')} <span className="font-bold">{order.totalTons}t</span> {t('prep_of')} {order.styleNo}. {t('alert_suffix')}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InventoryChart data={chartData} />
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 h-80 overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center"><Activity size={18} className="mr-2 text-indigo-500" />{t('inv_health')}</h3>
          <div className="space-y-4">
            {chartData.map((item) => {
              const isShortage = item.TotalAvailable < item.Demand;
              const gap = item.Demand - item.TotalAvailable;
              return (
                <div key={item.name} className="flex flex-col space-y-1 pb-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{item.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isShortage ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300' : 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'}`}>{isShortage ? `-${gap.toFixed(1)} t` : 'OK'}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1"><span>{t('coverage')}: {Math.min(item.Coverage, 100).toFixed(0)}%</span><span>{item.TotalAvailable} / {item.Demand} t</span></div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${isShortage ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(item.Coverage, 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 发货排程看板 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center"><Calendar size={18} className="mr-2 text-blue-500" />{t('today_shipments')}</h3>
          <div className="space-y-3">
            {todayShipments.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">{t('no_orders_load')}</p>}
            {todayShipments.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{order.client}</span>
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                    {order.isLargeOrder && <span className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-0.5 rounded text-xs">{t('tag_large')}</span>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-3">
                    <span>{order.totalTons}t / {order.containers}{t('table_containers')}</span>
                    <span className="flex items-center"><Clock size={10} className="mr-1" />{getLoadingTimeText(order.loadingTimeSlot)}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${getWorkshopStatusColor(order.workshopCommStatus)}`}>
                  {order.workshopCommStatus === WorkshopCommStatus.CONFIRMED ? '✓' : order.workshopCommStatus === WorkshopCommStatus.ISSUE ? '!' : '...'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center"><Truck size={18} className="mr-2 text-indigo-500" />{t('upcoming_shipments')}</h3>
          <div className="space-y-3">
            {upcomingShipments.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">{t('no_orders_load')}</p>}
            {upcomingShipments.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{order.client}</span>
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{order.expectedShipDate} · {order.totalTons}t</div>
                </div>
                {order.prepDaysRequired && order.prepDaysRequired > 0 && (
                  <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-1 rounded text-xs">{t('prep_alert')} {order.prepDaysRequired}{t('days')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center text-red-600 dark:text-red-400"><AlertOctagon size={18} className="mr-2" />{t('incident_recent')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400"><tr><th className="px-4 py-2">{t('table_date')}</th><th className="px-4 py-2">{t('table_style')}</th><th className="px-4 py-2">Reported By</th><th className="px-4 py-2">Issue</th><th className="px-4 py-2">Notes</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {unresolvedIncidents.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400 dark:text-slate-500">{t('no_incidents')}</td></tr>}
              {unresolvedIncidents.map((inc) => (<tr key={inc.id}><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{inc.timestamp}</td><td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{inc.styleNo}</td><td className="px-4 py-3"><span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-xs">{inc.reportedBy}</span></td><td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{t(`reason_${inc.reason}` as any) || inc.reason}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-md truncate">{inc.note}</td></tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
