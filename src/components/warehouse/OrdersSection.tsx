import React from 'react';
import { Order, OrderStatus, IncidentLog, LoadingTimeSlot, WorkshopCommStatus } from '../../types';
import { useLanguage } from '../../i18n';
import { Truck, CheckCircle, AlertTriangle, AlertOctagon, Clock, Package, Check, Trash2 } from 'lucide-react';
import { useIsMobile } from '../../hooks';

interface OrdersSectionProps {
  orders: Order[];
  incidents: IncidentLog[];
  activeTab: 'orders' | 'incidents';
  onConfirmLoad: (orderId: string, autoDeductStock?: boolean) => void;
  onOpenIncident: (order: Order) => void;
  onResolveIncident?: (id: string, resolved: boolean) => void;
  onDeleteIncident?: (id: string) => void;
}

const OrdersSection: React.FC<OrdersSectionProps> = ({ orders, incidents, activeTab, onConfirmLoad, onOpenIncident, onResolveIncident, onDeleteIncident }) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const pendingLoadOrders = orders.filter(o => o.status === OrderStatus.READY_TO_SHIP);
  const shippedOrders = orders.filter(o => o.status === OrderStatus.SHIPPED);

  const getLoadingTimeText = (slot?: LoadingTimeSlot) => {
    switch (slot) {
      case LoadingTimeSlot.MORNING: return t('loading_morning');
      case LoadingTimeSlot.AFTERNOON: return t('loading_afternoon');
      default: return t('loading_flexible');
    }
  };

  const getWorkshopStatusOk = (status?: WorkshopCommStatus) => status === WorkshopCommStatus.CONFIRMED;

  if (activeTab === 'orders') {
    return isMobile ? (
      /* 待装车Tab - 移动端卡片视图 */
      <div className="space-y-3">
        <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-3 rounded-xl flex items-center">
          <Truck className="text-blue-600 dark:text-blue-400 mr-2" size={18}/><h3 className="font-semibold text-blue-900 dark:text-blue-100 text-sm">{t('wh_pending_load')}</h3>
          <span className="ml-2 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs px-1.5 py-0.5 rounded-full font-bold">{pendingLoadOrders.length}</span>
        </div>
        {pendingLoadOrders.length === 0 && <div className="text-center py-8 text-slate-400">{t('no_orders_load')}</div>}
        {pendingLoadOrders.map(order => (
          <div key={order.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 ${!getWorkshopStatusOk(order.workshopCommStatus) ? 'border-l-4 border-l-amber-400' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 dark:text-slate-100">{order.client}</span>
              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{order.styleNo}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div><span className="text-slate-400">{t('wh_total')}:</span> <span className="font-semibold">{order.totalTons}t</span></div>
              <div><span className="text-slate-400">{t('wh_containers')}:</span> {order.containers}{t('container_unit')}</div>
              <div><span className="text-slate-400">{t('wh_port')}:</span> {order.port || '-'}</div>
              <div className="flex items-center"><Clock size={10} className="mr-1 text-slate-400"/>{getLoadingTimeText(order.loadingTimeSlot)}</div>
            </div>
            {order.isLargeOrder && <span className="inline-block bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-0.5 rounded text-xs font-bold mb-2">{t('tag_large')}</span>}
            {!getWorkshopStatusOk(order.workshopCommStatus) && <span className="inline-block ml-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded mb-2">{t('ws_in_progress')}</span>}
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => onOpenIncident(order)} className="flex-1 flex items-center justify-center px-2 py-1.5 border border-red-200 text-red-600 rounded text-xs"><AlertTriangle size={12} className="mr-1" />{t('wh_report_issue')}</button>
              <button onClick={() => onConfirmLoad(order.id)} className="flex-1 flex items-center justify-center px-2 py-1.5 bg-green-600 text-white rounded text-xs"><CheckCircle size={12} className="mr-1" />{t('wh_confirm_load')}</button>
            </div>
          </div>
        ))}
        {shippedOrders.length > 0 && (
          <>
            <div className="bg-green-50 dark:bg-green-900/30 px-4 py-3 rounded-xl flex items-center mt-4">
              <Package className="text-green-600 dark:text-green-400 mr-2" size={18}/><h3 className="font-semibold text-green-900 dark:text-green-100 text-sm">{t('wh_shipped_today')}</h3>
              <span className="ml-2 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs px-1.5 py-0.5 rounded-full font-bold">{shippedOrders.length}</span>
            </div>
            {shippedOrders.map(o => (
              <div key={o.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 opacity-70">
                <div className="flex items-center justify-between"><span className="font-medium text-slate-700 dark:text-slate-200">{o.client}</span><span className="font-mono text-xs">{o.styleNo}</span></div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-1"><span>{o.totalTons}t · {o.containers}{t('container_unit')}</span><span>{o.port}</span></div>
              </div>
            ))}
          </>
        )}
      </div>
    ) : (
      /* 待装车Tab - 桌面端 */
      <>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/30 px-6 py-4 border-b border-blue-100 dark:border-blue-800 flex items-center">
            <Truck className="text-blue-600 dark:text-blue-400 mr-2" size={20}/><h3 className="font-semibold text-blue-900 dark:text-blue-100">{t('wh_pending_load')}</h3>
            <span className="ml-2 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full font-bold">{pendingLoadOrders.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pendingLoadOrders.length === 0 && <div className="p-8 text-center text-slate-400 dark:text-slate-500">{t('no_orders_load')}</div>}
            {pendingLoadOrders.map(order => (
              <div key={order.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition ${!getWorkshopStatusOk(order.workshopCommStatus) ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">{order.client}</span>
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{order.styleNo}</span>
                      {order.isLargeOrder && <span className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-0.5 rounded text-xs font-bold">{t('tag_large')}</span>}
                      <span className="flex items-center text-xs text-slate-500 dark:text-slate-400"><Clock size={12} className="mr-1" />{getLoadingTimeText(order.loadingTimeSlot)}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_po')}</span><p className="font-mono text-xs">{order.piNo}</p></div>
                      <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_bl')}</span><p className="font-mono text-xs">{order.blNo || '-'}</p></div>
                      <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_total')}</span><p className="font-semibold">{order.totalTons} t</p></div>
                      <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_containers')}</span><p>{order.containers} ({order.packagesPerContainer}{t('table_pkg_per_cont')})</p></div>
                      <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_port')}</span><p>{order.port}</p></div>
                      <div><span className="text-slate-400 dark:text-slate-500 text-xs">{t('table_contact')}</span><p><span className="bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs">{order.contactPerson}</span></p></div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded">{t('table_requirements')}: {order.requirements}</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {!getWorkshopStatusOk(order.workshopCommStatus) && <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">{t('ws_in_progress')}</span>}
                    <button onClick={() => onOpenIncident(order)} className="flex items-center px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-medium transition"><AlertTriangle size={16} className="mr-2" />{t('btn_report_issue')}</button>
                    <button onClick={() => onConfirmLoad(order.id)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm text-sm font-medium transition"><CheckCircle size={18} className="mr-2" />{t('btn_confirm_load')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {shippedOrders.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-4">
            <div className="bg-green-50 dark:bg-green-900/30 px-6 py-4 border-b border-green-100 dark:border-green-800 flex items-center">
              <Package className="text-green-600 dark:text-green-400 mr-2" size={20}/><h3 className="font-semibold text-green-900 dark:text-green-100">{t('wh_shipped_today')}</h3>
              <span className="ml-2 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full font-bold">{shippedOrders.length}</span>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead className="text-slate-500 dark:text-slate-400 text-xs"><tr><th className="text-left py-2">{t('table_client')}</th><th className="text-left">{t('table_style')}</th><th className="text-right">{t('table_total')}</th><th className="text-center">{t('table_containers')}</th><th className="text-left">{t('table_port')}</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {shippedOrders.map(o => (<tr key={o.id} className="text-slate-600 dark:text-slate-300"><td className="py-2 font-medium">{o.client}</td><td className="font-mono text-xs">{o.styleNo}</td><td className="text-right">{o.totalTons}t</td><td className="text-center">{o.containers}</td><td>{o.port}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  }

  // 异常记录Tab
  return isMobile ? (
    /* 异常记录Tab - 移动端卡片视图 */
    <div className="space-y-3">
      <div className="bg-red-50 dark:bg-red-900/30 px-4 py-3 rounded-xl flex items-center">
        <AlertOctagon className="text-red-600 dark:text-red-400 mr-2" size={18}/><h3 className="font-semibold text-red-900 dark:text-red-100 text-sm">{t('incident_log')}</h3>
        <span className="ml-2 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs px-1.5 py-0.5 rounded-full font-bold">{incidents.length}</span>
      </div>
      {incidents.length === 0 && <div className="text-center py-8 text-slate-400">{t('no_incidents')}</div>}
      {incidents.map(inc => (
        <div key={inc.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 ${inc.resolved ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{inc.styleNo}</span>
            {inc.resolved ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">{t('status_resolved')}</span> : <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">{t('status_pending_resolve')}</span>}
          </div>
          <div className="text-xs text-slate-500 mb-2">{inc.orderClient || '-'} · {inc.timestamp}</div>
          <div className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">{t(`reason_${inc.reason}` as any) || inc.reason}</div>
          {inc.note && <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded mb-2">{inc.note}</div>}
          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            {!inc.resolved && onResolveIncident && <button onClick={() => onResolveIncident(inc.id, true)} className="flex-1 flex items-center justify-center px-2 py-1.5 bg-green-100 text-green-700 rounded text-xs"><Check size={12} className="mr-1" />{t('inc_resolved')}</button>}
            {inc.resolved && onResolveIncident && <button onClick={() => onResolveIncident(inc.id, false)} className="flex-1 flex items-center justify-center px-2 py-1.5 bg-orange-100 text-orange-700 rounded text-xs"><AlertTriangle size={12} className="mr-1" />{t('inc_reopen')}</button>}
            {onDeleteIncident && <button onClick={() => { if (confirm(t('confirm_delete_record'))) onDeleteIncident(inc.id); }} className="px-3 py-1.5 text-slate-400 hover:text-red-500 rounded text-xs"><Trash2 size={14} /></button>}
          </div>
        </div>
      ))}
    </div>
  ) : (
    /* 异常记录Tab - 桌面端表格 */
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="bg-red-50 dark:bg-red-900/30 px-6 py-4 border-b border-red-100 dark:border-red-800 flex items-center">
        <AlertOctagon className="text-red-600 dark:text-red-400 mr-2" size={20}/><h3 className="font-semibold text-red-900 dark:text-red-100">{t('incident_log')}</h3>
        <span className="ml-2 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs px-2 py-0.5 rounded-full font-bold">{incidents.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
            <tr><th className="px-4 py-3 text-left">{t('table_date')}</th><th className="px-4 py-3 text-left">{t('table_style')}</th><th className="px-4 py-3 text-left">{t('table_client')}</th><th className="px-4 py-3 text-left">{t('label_reason')}</th><th className="px-4 py-3 text-left">{t('label_notes')}</th><th className="px-4 py-3 text-center">{t('workshop_status')}</th><th className="px-4 py-3 text-center w-24">{t('table_actions')}</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {incidents.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">{t('no_incidents')}</td></tr>}
            {incidents.map(inc => (
              <tr key={inc.id} className={inc.resolved ? 'bg-slate-50 dark:bg-slate-900 opacity-60' : ''}>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{inc.timestamp}</td>
                <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{inc.styleNo}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{inc.orderClient || '-'}</td>
                <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{t(`reason_${inc.reason}` as any) || inc.reason}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{inc.note}</td>
                <td className="px-4 py-3 text-center">{inc.resolved ? <div><span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-xs">{t('status_resolved')}</span>{inc.resolvedAt && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(inc.resolvedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}</div> : <span className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-xs">{t('status_pending_resolve')}</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center space-x-1">
                    {!inc.resolved && onResolveIncident && <button onClick={() => onResolveIncident(inc.id, true)} className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50 rounded" title={t('mark_resolved')}><Check size={14} /></button>}
                    {inc.resolved && onResolveIncident && <button onClick={() => onResolveIncident(inc.id, false)} className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/50 rounded" title={t('reopen')}><AlertTriangle size={14} /></button>}
                    {onDeleteIncident && <button onClick={() => { if (confirm(t('confirm_delete_record'))) onDeleteIncident(inc.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersSection;
