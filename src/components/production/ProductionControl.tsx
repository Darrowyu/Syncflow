import React, { useState, useMemo, useEffect } from 'react';
import { ProductLine, LineStatus, Style } from '../../types';
import { Plus, Trash2, Package, Edit2, Factory, Activity, TrendingUp, ChevronDown, ChevronUp, Clock, History, ArrowRight, GitBranch, X } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { calculateExportCapacity } from '../../utils';
import { Modal } from '../common';
import { fetchStyleLogs } from '../../services/api';

interface StyleChangeLog { id: number; lineId: number; fromStyle: string; toStyle: string; changedAt: string; }

interface ProductionControlProps {
  lines: ProductLine[];
  styles?: Style[];
  onUpdateLine: (lineId: number, updates: Partial<ProductLine>) => void;
  onAddLine?: (data: Partial<ProductLine>) => Promise<number>;
  onRemoveLine?: (id: number) => void;
  onAddStyle?: (data: Omit<Style, 'id'>) => void;
  onUpdateStyle?: (id: number, data: Partial<Style>) => void;
  onRemoveStyle?: (id: number) => void;
  onCompleteProduction?: (lineId: number, styleNo: string, quantity: number, grade?: string) => Promise<void>; // 完成生产入库
}

const ProductionControl: React.FC<ProductionControlProps> = ({ lines, styles = [], onUpdateLine, onAddLine, onRemoveLine, onAddStyle, onUpdateStyle, onRemoveStyle, onCompleteProduction }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'lines' | 'styles'>('lines');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'line' | 'style'; id: number } | null>(null);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [editingStyle, setEditingStyle] = useState<Style | null>(null);
  const [styleForm, setStyleForm] = useState({ styleNo: '', name: '', category: '', unitWeight: 0, note: '' });
  const [showStyleCapacity, setShowStyleCapacity] = useState(false);
  const [historyLineId, setHistoryLineId] = useState<number | null>(null);
  const [styleLogs, setStyleLogs] = useState<StyleChangeLog[]>([]);
  const [editingLine, setEditingLine] = useState<ProductLine | null>(null);

  useEffect(() => {
    if (historyLineId) {
      fetchStyleLogs(historyLineId).then(setStyleLogs).catch(() => setStyleLogs([]));
    }
  }, [historyLineId]);

  // 按款号分组统计产能（考虑分支）- 使用JSON序列化确保深度依赖检测
  const linesKey = JSON.stringify(lines.map(l => ({ id: l.id, status: l.status, currentStyle: l.currentStyle, dailyCapacity: l.dailyCapacity, exportCapacity: l.exportCapacity, subLines: l.subLines })));
  const styleCapacityData = useMemo(() => {
    const grouped: Record<string, { lines: string[]; totalCapacity: number; exportCapacity: number }> = {};
    lines.filter(l => l.status === LineStatus.RUNNING).forEach(line => {
      const hasSubLines = line.subLines && line.subLines.length > 0;
      if (hasSubLines) {
        line.subLines!.forEach(sub => {
          if (sub.currentStyle && sub.currentStyle !== '-') {
            if (!grouped[sub.currentStyle]) grouped[sub.currentStyle] = { lines: [], totalCapacity: 0, exportCapacity: 0 };
            const lineName = `${line.name}-${sub.name}`;
            if (!grouped[sub.currentStyle].lines.includes(lineName)) grouped[sub.currentStyle].lines.push(lineName);
            grouped[sub.currentStyle].totalCapacity += sub.dailyCapacity;
            grouped[sub.currentStyle].exportCapacity += sub.exportCapacity || 0;
          }
        });
      } else if (line.currentStyle && line.currentStyle !== '-') {
        if (!grouped[line.currentStyle]) grouped[line.currentStyle] = { lines: [], totalCapacity: 0, exportCapacity: 0 };
        if (!grouped[line.currentStyle].lines.includes(line.name)) grouped[line.currentStyle].lines.push(line.name);
        grouped[line.currentStyle].totalCapacity += line.dailyCapacity;
        grouped[line.currentStyle].exportCapacity += line.exportCapacity || 0;
      }
    });
    return Object.entries(grouped).map(([styleNo, data]) => ({ styleNo, ...data })).sort((a, b) => b.totalCapacity - a.totalCapacity);
  }, [linesKey, lines]);

  const handleAddLine = async () => {
    if (!onAddLine) return;
    await onAddLine({ name: newLineName.trim() || `Line ${lines.length + 1}`, status: LineStatus.STOPPED, currentStyle: '-', dailyCapacity: 0, exportCapacity: 0 });
    setNewLineName('');
    setShowAddModal(false);
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'line' && onRemoveLine) onRemoveLine(deleteConfirm.id);
    if (deleteConfirm.type === 'style' && onRemoveStyle) onRemoveStyle(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handleOpenStyleModal = (style?: Style) => {
    if (style) {
      setEditingStyle(style);
      setStyleForm({ styleNo: style.styleNo, name: style.name || '', category: style.category || '', unitWeight: style.unitWeight || 0, note: style.note || '' });
    } else {
      setEditingStyle(null);
      setStyleForm({ styleNo: '', name: '', category: '', unitWeight: 0, note: '' });
    }
    setShowStyleModal(true);
  };

  const handleSaveStyle = () => {
    if (!styleForm.styleNo.trim()) return;
    if (editingStyle && onUpdateStyle) {
      onUpdateStyle(editingStyle.id, styleForm);
    } else if (onAddStyle) {
      onAddStyle(styleForm);
    }
    setShowStyleModal(false);
  };

  const styleOptions = styles.map(s => s.styleNo);

  // 计算统计数据（考虑分支）
  const runningLinesCount = lines.filter(l => l.status === LineStatus.RUNNING).length;
  const totalCapacity = lines.filter(l => l.status === LineStatus.RUNNING).reduce((sum, l) => {
    const hasSubLines = l.subLines && l.subLines.length > 0;
    return sum + (hasSubLines ? l.subLines!.reduce((s, sub) => s + sub.dailyCapacity, 0) : l.dailyCapacity);
  }, 0);
  const totalExportCapacity = lines.filter(l => l.status === LineStatus.RUNNING).reduce((sum, l) => {
    const hasSubLines = l.subLines && l.subLines.length > 0;
    return sum + (hasSubLines ? l.subLines!.reduce((s, sub) => s + (sub.exportCapacity || 0), 0) : (l.exportCapacity || 0));
  }, 0);

  return (
    <div className="space-y-6">
      {/* 顶部总览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center"><Factory size={20} className="text-indigo-600 dark:text-indigo-400" /></div>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{lines.length}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('total_lines')}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/50 rounded-lg flex items-center justify-center"><Activity size={20} className="text-green-600 dark:text-green-400" /></div>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{runningLinesCount}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('running_lines')}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/50 rounded-lg flex items-center justify-center"><TrendingUp size={20} className="text-blue-600 dark:text-blue-400" /></div>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalCapacity.toFixed(0)}t</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('total_capacity_day')}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center"><TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" /></div>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalExportCapacity.toFixed(1)}t</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('export_available_day')}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/50 rounded-lg flex items-center justify-center"><Package size={20} className="text-purple-600 dark:text-purple-400" /></div>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{styles.length}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('style_count')}</p>
        </div>
      </div>

      {/* 款号产能详情折叠面板 */}
      {styleCapacityData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button onClick={() => setShowStyleCapacity(!showStyleCapacity)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition">
            <div className="flex items-center space-x-2">
              <Package size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">{t('style_capacity_dist')}</span>
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">{styleCapacityData.length} {t('styles_in_production')}</span>
            </div>
            {showStyleCapacity ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showStyleCapacity ? 'max-h-96' : 'max-h-0'}`}>
            <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {styleCapacityData.map(item => (
                <div key={item.styleNo} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{item.styleNo}</span>
                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">{item.lines.length}线</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex justify-between"><span>{t('total_cap')}</span><span className="font-mono font-medium text-slate-700 dark:text-slate-200">{item.totalCapacity.toFixed(1)}t</span></div>
                    <div className="flex justify-between"><span>{t('export_avail')}</span><span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{item.exportCapacity.toFixed(1)}t</span></div>
                    <div className="text-slate-400 dark:text-slate-500 truncate" title={item.lines.join(', ')}>{t('lines_label')}: {item.lines.join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end items-center">
        <div className="flex space-x-2">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
            <button onClick={() => setActiveTab('lines')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${activeTab === 'lines' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('line_management')}</button>
            <button onClick={() => setActiveTab('styles')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${activeTab === 'styles' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('style_maintenance')}</button>
          </div>
          {activeTab === 'lines' && onAddLine && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"><Plus size={16} className="mr-2" />{t('add_line')}</button>
          )}
          {activeTab === 'styles' && onAddStyle && (
            <button onClick={() => handleOpenStyleModal()} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"><Plus size={16} className="mr-2" />{t('add_style')}</button>
          )}
        </div>
      </div>

      {/* 添加产线弹窗 */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t('add_new_line')} titleIcon={<Plus size={20} />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('line_name')}</label>
            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" placeholder={`Line ${lines.length + 1}`} value={newLineName} onChange={(e) => setNewLineName(e.target.value)} />
          </div>
          <button onClick={handleAddLine} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">{t('confirm_add')}</button>
        </div>
      </Modal>

      {/* 款号编辑弹窗 */}
      <Modal isOpen={showStyleModal} onClose={() => setShowStyleModal(false)} title={editingStyle ? t('edit_style') : t('add_style')} titleIcon={<Package size={20} />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('style_no')} *</label>
            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="BE3250" value={styleForm.styleNo} onChange={(e) => setStyleForm({ ...styleForm, styleNo: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('style_name_label')}</label>
            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="" value={styleForm.name} onChange={(e) => setStyleForm({ ...styleForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('category')}</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="A/B" value={styleForm.category} onChange={(e) => setStyleForm({ ...styleForm, category: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('unit_weight')}</label>
              <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={styleForm.unitWeight} onChange={(e) => setStyleForm({ ...styleForm, unitWeight: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('note')}</label>
            <textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm h-16" value={styleForm.note} onChange={(e) => setStyleForm({ ...styleForm, note: e.target.value })} />
          </div>
          <button onClick={handleSaveStyle} disabled={!styleForm.styleNo.trim()} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">{editingStyle ? t('save_changes') : t('confirm_add')}</button>
        </div>
      </Modal>

      {/* 款号变更历史弹窗 */}
      <Modal isOpen={historyLineId !== null} onClose={() => setHistoryLineId(null)} title={`${lines.find(l => l.id === historyLineId)?.name || ''} ${t('style_change_history')}`} titleIcon={<History size={20} />}>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {styleLogs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t('no_change_records')}</p>
          ) : (
            styleLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-slate-500">{log.fromStyle || '-'}</span>
                  <ArrowRight size={14} className="text-slate-400" />
                  <span className="font-mono font-medium text-indigo-600">{log.toStyle}</span>
                </div>
                <span className="text-xs text-slate-400">{new Date(log.changedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal isOpen={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title={t('confirm_delete')} titleIcon={<Trash2 size={20} />} titleClassName="text-red-600">
        <div className="space-y-4">
          <p className="text-slate-600">{t('delete_warning')}</p>
          <div className="flex space-x-3">
            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">{t('btn_cancel')}</button>
            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">{t('confirm_delete_btn')}</button>
          </div>
        </div>
      </Modal>

      {/* 产线编辑弹窗 */}
      <Modal isOpen={editingLine !== null} onClose={() => setEditingLine(null)} title={`${t('edit_line')} ${editingLine?.name || ''}`} titleIcon={<Factory size={20} />}>
        {editingLine && (() => {
          const line = lines.find(l => l.id === editingLine.id) || editingLine;
          const hasSubLines = line.subLines && line.subLines.length > 0;
          const hasBigPipe = hasSubLines && line.subLines!.some(s => s.name === '大管');
          const hasSmallPipe = hasSubLines && line.subLines!.some(s => s.name === '小管');
          const handleAddSubLine = (type: 'big' | 'small') => {
            const name = type === 'big' ? '大管' : '小管';
            if ((type === 'big' && hasBigPipe) || (type === 'small' && hasSmallPipe)) return;
            const newSub = { id: `sub-${line.id}-${Date.now()}`, name, currentStyle: '-', dailyCapacity: 0, exportCapacity: 0 };
            if (hasSubLines) {
              onUpdateLine(line.id, { subLines: [...line.subLines!, newSub] });
            } else {
              onUpdateLine(line.id, { subLines: [newSub], currentStyle: '-' });
            }
          };
          const handleRemoveSubLine = (idx: number) => {
            const newSubs = line.subLines!.filter((_, i) => i !== idx);
            if (newSubs.length === 0) {
              onUpdateLine(line.id, { subLines: [], currentStyle: '-', dailyCapacity: 0, exportCapacity: 0 });
            } else {
              onUpdateLine(line.id, { subLines: newSubs });
            }
          };
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('line_name')}</label>
                  <input type="text" value={line.name} onChange={(e) => onUpdateLine(line.id, { name: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('workshop_status')}</label>
                  <select value={line.status} onChange={(e) => onUpdateLine(line.id, { status: e.target.value as LineStatus })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm">
                    <option value={LineStatus.RUNNING}>{t('line_running')}</option>
                    <option value={LineStatus.MAINTENANCE}>{t('line_maintenance')}</option>
                    <option value={LineStatus.STOPPED}>{t('line_stopped')}</option>
                  </select>
                </div>
              </div>
              {hasSubLines ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">{t('branch_config')}</label>
                  {line.subLines!.map((sub, idx) => (
                    <div key={sub.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 relative">
                      <button onClick={() => handleRemoveSubLine(idx)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X size={14} /></button>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <span className="text-xs text-slate-500">名称</span>
                          <input type="text" value={sub.name} readOnly className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm mt-0.5 bg-slate-50 text-slate-600" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">款号</span>
                          <select value={sub.currentStyle} onChange={(e) => { const newSubs = [...line.subLines!]; newSubs[idx] = { ...sub, currentStyle: e.target.value }; onUpdateLine(line.id, { subLines: newSubs }); }} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm mt-0.5">
                            <option value="-">-</option>
                            {styleOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">产能(t)</span>
                          <input type="number" value={sub.dailyCapacity} onChange={(e) => { const newSubs = [...line.subLines!]; newSubs[idx] = { ...sub, dailyCapacity: parseFloat(e.target.value) || 0 }; onUpdateLine(line.id, { subLines: newSubs }); }} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">外贸(t)</span>
                          <input type="number" value={sub.exportCapacity || 0} onChange={(e) => { const newSubs = [...line.subLines!]; newSubs[idx] = { ...sub, exportCapacity: parseFloat(e.target.value) || 0 }; onUpdateLine(line.id, { subLines: newSubs }); }} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('style_no')}</label>
                    <select value={line.currentStyle} onChange={(e) => onUpdateLine(line.id, { currentStyle: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm">
                      <option value="-">-</option>
                      {styleOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('capacity_t')}</label>
                    <input type="number" value={line.dailyCapacity} onChange={(e) => onUpdateLine(line.id, { dailyCapacity: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('export_t')}</label>
                    <input type="number" value={line.exportCapacity || 0} onChange={(e) => onUpdateLine(line.id, { exportCapacity: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
                  </div>
                </div>
              )}
              {!(hasBigPipe && hasSmallPipe) && (
                <div className="flex space-x-2">
                  {!hasBigPipe && <button onClick={() => handleAddSubLine('big')} className="flex-1 py-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50"><GitBranch size={14} className="inline mr-1" />+{t('big_pipe')}</button>}
                  {!hasSmallPipe && <button onClick={() => handleAddSubLine('small')} className="flex-1 py-2 text-sm text-orange-600 border border-dashed border-orange-300 rounded-lg hover:bg-orange-50"><GitBranch size={14} className="inline mr-1" />+{t('small_pipe')}</button>}
                </div>
              )}
              {onCompleteProduction && hasSubLines && line.subLines!.map((sub, idx) => {
                if (sub.currentStyle === '-' || (sub.exportCapacity || 0) <= 0) return null;
                return (
                  <button key={sub.id} onClick={async () => { await onCompleteProduction(line.id, sub.currentStyle, sub.exportCapacity || 0); const newSubs = [...line.subLines!]; newSubs[idx] = { ...sub, exportCapacity: 0 }; onUpdateLine(line.id, { subLines: newSubs }); }} className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center"><Package size={16} className="mr-2" />{sub.name} {sub.currentStyle} {t('complete_stock_in')} ({sub.exportCapacity}t)</button>
                );
              })}
              {onCompleteProduction && !hasSubLines && line.currentStyle !== '-' && (line.exportCapacity || 0) > 0 && (
                <button onClick={async () => { await onCompleteProduction(line.id, line.currentStyle, line.exportCapacity || 0); onUpdateLine(line.id, { exportCapacity: 0 }); }} className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center"><Package size={16} className="mr-2" />{line.currentStyle} {t('complete_stock_in')} ({line.exportCapacity}t)</button>
              )}
              <button onClick={() => setEditingLine(null)} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">{t('close_btn')}</button>
            </div>
          );
        })()}
      </Modal>

      {/* 产线管理 */}
      {activeTab === 'lines' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {lines.map((line) => {
            const hasSubLines = line.subLines && line.subLines.length > 0;
            const totalCap = hasSubLines ? line.subLines!.reduce((s, sub) => s + sub.dailyCapacity, 0) : line.dailyCapacity;
            const totalExport = hasSubLines ? line.subLines!.reduce((s, sub) => s + (sub.exportCapacity || 0), 0) : (line.exportCapacity || 0);
            const displayStyle = hasSubLines ? line.subLines!.map(s => s.currentStyle).filter(s => s !== '-').join('/') || '-' : line.currentStyle;
            const statusColor = line.status === LineStatus.RUNNING ? 'bg-green-500' : line.status === LineStatus.MAINTENANCE ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-600';

            return (
              <div key={line.id} onClick={() => setEditingLine(line)} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition group">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{line.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                    {hasSubLines && <GitBranch size={12} className="text-slate-400 dark:text-slate-500" />}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('style_no')}</span><span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[80px]" title={displayStyle}>{displayStyle}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('capacity_t')}</span><span className="font-mono text-slate-700 dark:text-slate-300">{totalCap}t</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('export_t')}</span><span className="font-mono text-green-600 dark:text-green-400 font-medium">{totalExport}t</span></div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <button onClick={(e) => { e.stopPropagation(); setHistoryLineId(line.id); }} className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"><History size={12} className="inline mr-1" />{t('history_btn')}</button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'line', id: line.id }); }} className="text-xs text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 款号维护 */}
      {activeTab === 'styles' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">{t('style_no_col')}</th>
                <th className="px-4 py-3 text-left">{t('name_col')}</th>
                <th className="px-4 py-3 text-left">{t('category_col')}</th>
                <th className="px-4 py-3 text-right">{t('unit_weight_col')}</th>
                <th className="px-4 py-3 text-left">{t('note_col')}</th>
                <th className="px-4 py-3 text-center w-24">{t('actions_col')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {styles.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">{t('no_style_data')}</td></tr>}
              {styles.map(style => (
                <tr key={style.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-slate-100">{style.styleNo}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{style.name || '-'}</td>
                  <td className="px-4 py-3"><span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs">{style.category || '-'}</span></td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{style.unitWeight || 0}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">{style.note || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center space-x-2">
                      {onUpdateStyle && <button onClick={() => handleOpenStyleModal(style)} className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><Edit2 size={14} /></button>}
                      {onRemoveStyle && <button onClick={() => setDeleteConfirm({ type: 'style', id: style.id })} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductionControl;
