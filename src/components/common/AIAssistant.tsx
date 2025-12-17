import React, { useState } from 'react';
import { Bot, Send, Loader2, X, Sparkles, BarChart3, AlertTriangle, Truck, Factory } from 'lucide-react';
import { Order, ProductLine, InventoryItem, IncidentLog } from '../../types';
import { getProductionSuggestion, getInventoryAnalysis, getIncidentAnalysis, getShippingPriority, queryWithAI } from '../../services';
import { useLanguage } from '../../i18n';

interface AIAssistantProps {
  orders: Order[];
  lines: ProductLine[];
  inventory: InventoryItem[];
  incidents: IncidentLog[];
  onClose: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ orders, lines, inventory, incidents, onClose }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const quickActions = [
    { id: 'production', icon: <Factory size={16} />, label: t('production_suggestion'), action: () => runAction('production', () => getProductionSuggestion(orders, lines, inventory)) },
    { id: 'inventory', icon: <BarChart3 size={16} />, label: t('inventory_analysis'), action: () => runAction('inventory', () => getInventoryAnalysis(orders, inventory, lines)) },
    { id: 'incident', icon: <AlertTriangle size={16} />, label: t('incident_analysis'), action: () => runAction('incident', () => getIncidentAnalysis(incidents)) },
    { id: 'shipping', icon: <Truck size={16} />, label: t('shipping_priority'), action: () => runAction('shipping', () => getShippingPriority(orders, inventory)) },
  ];

  const runAction = async (id: string, fn: () => Promise<string>) => {
    setLoading(true);
    setActiveAction(id);
    setResponse('');
    try {
      const result = await fn();
      setResponse(result);
    } catch (e) {
      setResponse(t('analysis_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;
    const q = query;
    setQuery(''); // 清空输入框
    setLoading(true);
    setActiveAction('query');
    try {
      const result = await queryWithAI(q, { orders, lines, inventory, incidents });
      setResponse(result);
    } catch {
      setResponse(t('query_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col max-h-[600px]">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 bg-indigo-600 rounded-t-2xl">
        <div className="flex items-center text-white">
          <Sparkles size={20} className="mr-2" />
          <span className="font-semibold">{t('ai_assistant')}</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
      </div>
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('quick_analysis')}</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map(a => (
            <button key={a.id} onClick={a.action} disabled={loading} className={`flex items-center px-3 py-2 rounded-lg text-sm transition ${activeAction === a.id ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'} disabled:opacity-50`}>
              <span className="mr-2">{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-[150px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-indigo-500 dark:text-indigo-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            <span className="text-sm">{t('analyzing')}</span>
          </div>
        ) : response ? (
          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{response}</div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <Bot size={32} className="mb-2" />
            <p className="text-sm">选择快捷分析或输入问题</p>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-slate-100 dark:border-slate-700">
        <div className="flex space-x-2">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuery()} placeholder={t('ask_placeholder')} className="flex-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={handleQuery} disabled={loading || !query.trim()} className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
