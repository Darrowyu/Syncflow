import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, CustomerStats, Order } from '../../types';
import { Users, Plus, Edit2, Trash2, RefreshCw, ChevronRight, Package, TrendingUp, Calendar } from 'lucide-react';
import { fetchCustomers, fetchCustomerStats, fetchCustomerOrders, createCustomer, updateCustomer, deleteCustomer, syncCustomers, invalidateCache } from '../../services/api';
import { toast } from '../common/Toast';
import { useLanguage } from '../../i18n';
import { Modal } from '../common';

interface CustomerManagementProps { orders: Order[] }

const CustomerManagement: React.FC<CustomerManagementProps> = ({ orders }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useLanguage();

  const loadCustomers = useCallback(async () => {
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const loadCustomerDetail = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [statsData, ordersData] = await Promise.all([fetchCustomerStats(id), fetchCustomerOrders(id)]);
      setStats(statsData);
      setCustomerOrders(ordersData);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedId) loadCustomerDetail(selectedId); }, [selectedId, loadCustomerDetail]);

  const handleSync = async () => {
    try {
      const result = await syncCustomers();
      invalidateCache('customers');
      await loadCustomers();
      toast.success(`${t('customer_sync_success')}: ${result.synced}, ${t('customer_created')}: ${result.created}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleSave = async () => {
    if (!editingCustomer?.name) return;
    try {
      if (editingCustomer.id) {
        await updateCustomer(editingCustomer.id, editingCustomer);
      } else {
        await createCustomer(editingCustomer);
      }
      invalidateCache('customers');
      await loadCustomers();
      setShowEditModal(false);
      setEditingCustomer(null);
      toast.success(t('toast_order_saved'));
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('customer_confirm_delete'))) return;
    try {
      await deleteCustomer(id);
      invalidateCache('customers');
      setCustomers(prev => prev.filter(c => c.id !== id));
      if (selectedId === id) { setSelectedId(null); setStats(null); }
      toast.success(t('toast_style_deleted'));
    } catch (e) { toast.error((e as Error).message); }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(term) || c.contactPerson?.toLowerCase().includes(term));
  }, [customers, searchTerm]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedId), [customers, selectedId]);

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] overflow-hidden">
      {/* 左侧客户列表 */}
      <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center"><Users size={18} className="mr-2" />{t('customer_list')}</h3>
            <div className="flex gap-1">
              <button onClick={handleSync} className="p-1.5 text-slate-400 hover:text-blue-600" title={t('customer_sync')}><RefreshCw size={16} /></button>
              <button onClick={() => { setEditingCustomer({}); setShowEditModal(true); }} className="p-1.5 text-slate-400 hover:text-green-600" title={t('customer_add')}><Plus size={16} /></button>
            </div>
          </div>
          <input type="text" placeholder={t('customer_search')} className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredCustomers.length === 0 && <div className="p-4 text-center text-slate-400">{t('customer_no_data')}</div>}
          {filteredCustomers.map(c => (
            <div key={c.id} onClick={() => setSelectedId(c.id)} className={`p-3 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedId === c.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{c.name}</span>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
              {c.contactPerson && <span className="text-xs text-slate-500">{c.contactPerson}</span>}
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 text-center">{filteredCustomers.length} {t('customer_list')}</div>
      </div>

      {/* 右侧客户详情 */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center text-slate-400"><Users size={48} className="opacity-30" /></div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center text-slate-400">Loading...</div>
        ) : (
          <div className="h-full flex flex-col">
            {/* 客户信息头部 */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedCustomer?.name}</h2>
                  <div className="flex gap-4 mt-1 text-sm text-slate-500">
                    {selectedCustomer?.contactPerson && <span>{t('customer_contact')}: {selectedCustomer.contactPerson}</span>}
                    {selectedCustomer?.phone && <span>{t('customer_phone')}: {selectedCustomer.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingCustomer(selectedCustomer || {}); setShowEditModal(true); }} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={18} /></button>
                  <button onClick={() => selectedId && handleDelete(selectedId)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
            {/* 统计卡片 */}
            {stats && (
              <div className="p-4 grid grid-cols-4 gap-4 border-b border-slate-200 dark:border-slate-700">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                  <div className="flex items-center text-blue-600 dark:text-blue-400 mb-1"><Package size={16} className="mr-1" /><span className="text-xs">{t('customer_order_count')}</span></div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.orderCount}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
                  <div className="flex items-center text-green-600 dark:text-green-400 mb-1"><TrendingUp size={16} className="mr-1" /><span className="text-xs">{t('customer_total_tons')}</span></div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.totalTons.toFixed(1)}t</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
                  <div className="flex items-center text-amber-600 dark:text-amber-400 mb-1"><Calendar size={16} className="mr-1" /><span className="text-xs">{t('customer_first_order')}</span></div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{stats.firstOrderDate || '-'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                  <div className="flex items-center text-slate-600 dark:text-slate-400 mb-1"><Calendar size={16} className="mr-1" /><span className="text-xs">{t('customer_last_order')}</span></div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{stats.lastOrderDate || '-'}</div>
                </div>
              </div>
            )}
            {/* 常购款号 */}
            {stats?.topStyles && stats.topStyles.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 mr-2">{t('customer_top_styles')}:</span>
                {stats.topStyles.map((s, i) => <span key={i} className="inline-block px-2 py-0.5 mr-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">{s.styleNo} ({s.tons.toFixed(1)}t)</span>)}
              </div>
            )}
            {/* 历史订单 */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">{t('customer_history')}</h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                  <tr><th className="px-2 py-2 text-left">{t('table_date')}</th><th className="px-2 py-2 text-left">{t('table_style')}</th><th className="px-2 py-2 text-left">{t('table_po')}</th><th className="px-2 py-2 text-right">{t('table_total')}</th><th className="px-2 py-2 text-center">{t('table_containers')}</th><th className="px-2 py-2 text-left">{t('table_port')}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {customerOrders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{o.date}</td>
                      <td className="px-2 py-2"><span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">{o.styleNo}</span></td>
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-300 font-mono text-xs">{o.piNo}</td>
                      <td className="px-2 py-2 text-right font-mono">{o.totalTons}</td>
                      <td className="px-2 py-2 text-center">{o.containers}</td>
                      <td className="px-2 py-2 text-slate-500">{o.port}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customerOrders.length === 0 && <div className="text-center py-8 text-slate-400">{t('no_orders_load')}</div>}
            </div>
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={editingCustomer?.id ? t('customer_edit') : t('customer_add')} titleIcon={<Users size={20} />}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('customer_name')} *</label><input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" value={editingCustomer?.name || ''} onChange={(e) => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('customer_contact')}</label><input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" value={editingCustomer?.contactPerson || ''} onChange={(e) => setEditingCustomer(prev => ({ ...prev, contactPerson: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('customer_phone')}</label><input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" value={editingCustomer?.phone || ''} onChange={(e) => setEditingCustomer(prev => ({ ...prev, phone: e.target.value }))} /></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('customer_email')}</label><input type="email" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" value={editingCustomer?.email || ''} onChange={(e) => setEditingCustomer(prev => ({ ...prev, email: e.target.value }))} /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('customer_address')}</label><input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" value={editingCustomer?.address || ''} onChange={(e) => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))} /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('customer_note')}</label><textarea className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm h-16 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" value={editingCustomer?.note || ''} onChange={(e) => setEditingCustomer(prev => ({ ...prev, note: e.target.value }))} /></div>
          <button onClick={handleSave} disabled={!editingCustomer?.name} className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">{t('btn_save')}</button>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerManagement;
