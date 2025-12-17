import React, { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Settings, X } from 'lucide-react';
import { InventoryAlert, InventoryItem } from '../../types';
import { useLanguage } from '../../i18n';
import { Modal } from '../common';

interface InventoryAlertsProps {
  inventory: InventoryItem[];
  onSetSafetyStock?: (styleNo: string, safetyStock: number, warehouseType?: string, packageSpec?: string) => Promise<void>;
  onGetAlerts?: () => Promise<InventoryAlert[]>;
}

const InventoryAlerts: React.FC<InventoryAlertsProps> = ({ inventory, onSetSafetyStock, onGetAlerts }) => {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [safetyStock, setSafetyStock] = useState(0);

  useEffect(() => { // 计算本地预警
    const localAlerts = inventory.filter(i => (i.safetyStock || 0) > 0 && i.currentStock < (i.safetyStock || 0)).map(i => ({ styleNo: i.styleNo, warehouseType: i.warehouseType, packageSpec: i.packageSpec, currentStock: i.currentStock, safetyStock: i.safetyStock || 0, shortage: (i.safetyStock || 0) - i.currentStock }));
    setAlerts(localAlerts);
  }, [inventory]);

  const handleOpenSettings = (item: InventoryItem) => {
    setSelectedItem(item);
    setSafetyStock(item.safetyStock || 0);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedItem || !onSetSafetyStock) return;
    await onSetSafetyStock(selectedItem.styleNo, safetyStock, selectedItem.warehouseType, selectedItem.packageSpec);
    setShowModal(false);
  };

  if (alerts.length === 0) return null;

  return (
    <>
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
        <div className="flex items-center mb-3">
          <Bell className="text-amber-600 dark:text-amber-400 mr-2" size={18} />
          <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm">{t('inv_alerts') || '库存预警'}</h4>
          <span className="ml-2 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs px-2 py-0.5 rounded-full font-bold">{alerts.length}</span>
        </div>
        <div className="space-y-2">
          {alerts.slice(0, 5).map(alert => (
            <div key={`${alert.styleNo}-${alert.warehouseType}-${alert.packageSpec}`} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg p-2 text-sm">
              <div className="flex items-center">
                <AlertTriangle size={14} className="text-amber-500 mr-2" />
                <span className="font-mono font-medium text-slate-800 dark:text-slate-100">{alert.styleNo}</span>
                <span className="text-xs text-slate-400 ml-2">{alert.warehouseType === 'bonded' ? '保税' : '一般'} · {alert.packageSpec}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-red-600 dark:text-red-400 font-mono">{alert.currentStock.toFixed(1)}t</span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">{alert.safetyStock.toFixed(1)}t</span>
                <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/50 px-1.5 py-0.5 rounded">缺{alert.shortage.toFixed(1)}t</span>
              </div>
            </div>
          ))}
          {alerts.length > 5 && <p className="text-xs text-amber-600 text-center">还有 {alerts.length - 5} 项预警...</p>}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="设置安全库存" titleIcon={<Settings size={20} />}>
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm">
              <div className="flex justify-between"><span className="text-slate-500">款号:</span><span className="font-mono font-bold">{selectedItem.styleNo}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">当前库存:</span><span className="font-mono">{selectedItem.currentStock.toFixed(1)}t</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">安全库存阈值 (t)</label>
              <input type="number" step="0.1" min="0" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-800" value={safetyStock} onChange={e => setSafetyStock(parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-slate-400 mt-1">当库存低于此值时将触发预警</p>
            </div>
            <button onClick={handleSave} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">保存</button>
          </div>
        )}
      </Modal>
    </>
  );
};

export default InventoryAlerts;