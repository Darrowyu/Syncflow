import React from 'react';
import { Order, ProductLine, TradeType, LoadingTimeSlot } from '../../types';
import { Edit2 } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { Modal } from '../common';

interface OrderEditModalProps {
    isOpen: boolean;
    order: Order | null;
    lines: ProductLine[];
    onClose: () => void;
    onChange: (order: Order) => void;
    onSave: () => void;
}

const OrderEditModal: React.FC<OrderEditModalProps> = ({ isOpen, order, lines, onClose, onChange, onSave }) => {
    const { t } = useLanguage();
    if (!order) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('edit_order')} titleIcon={<Edit2 size={20} />}>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_date')}</label><input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.date} onChange={(e) => onChange({ ...order, date: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_client')} *</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.client} onChange={(e) => onChange({ ...order, client: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_style')} *</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.styleNo} onChange={(e) => onChange({ ...order, styleNo: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_pi')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.piNo} onChange={(e) => onChange({ ...order, piNo: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_tons')} *</label><input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.totalTons} onChange={(e) => onChange({ ...order, totalTons: parseFloat(e.target.value) || 0 })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_containers')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.containers} onChange={(e) => onChange({ ...order, containers: parseInt(e.target.value) || 1 })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_pkg')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.packagesPerContainer} onChange={(e) => onChange({ ...order, packagesPerContainer: parseInt(e.target.value) || 30 })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_line')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.lineId || ''} onChange={(e) => onChange({ ...order, lineId: e.target.value ? parseInt(e.target.value) : undefined })}><option value="">-</option>{lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_bl')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.blNo || ''} onChange={(e) => onChange({ ...order, blNo: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_port')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.port} onChange={(e) => onChange({ ...order, port: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_contact')}</label><input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.contactPerson} onChange={(e) => onChange({ ...order, contactPerson: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_trade_type')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.tradeType} onChange={(e) => onChange({ ...order, tradeType: e.target.value as TradeType })}><option value={TradeType.GENERAL}>{t('trade_general')}</option><option value={TradeType.BONDED}>{t('trade_bonded')}</option></select></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_loading_time')}</label><select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.loadingTimeSlot || LoadingTimeSlot.FLEXIBLE} onChange={(e) => onChange({ ...order, loadingTimeSlot: e.target.value as LoadingTimeSlot })}><option value={LoadingTimeSlot.FLEXIBLE}>{t('loading_flexible')}</option><option value={LoadingTimeSlot.MORNING}>{t('loading_morning')}</option><option value={LoadingTimeSlot.AFTERNOON}>{t('loading_afternoon')}</option></select></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_prep_days')}</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={order.prepDaysRequired || 0} onChange={(e) => onChange({ ...order, prepDaysRequired: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('field_requirements')}</label><textarea className="w-full border border-slate-300 rounded-lg p-2 text-sm h-16" value={order.requirements} onChange={(e) => onChange({ ...order, requirements: e.target.value })} /></div>
                <button onClick={onSave} disabled={!order.client || !order.styleNo} className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">{t('btn_save')}</button>
            </div>
        </Modal>
    );
};

export default OrderEditModal;
