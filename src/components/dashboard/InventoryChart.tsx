import React, { useState, useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, LineChartIcon, PieChartIcon, TrendingDown } from 'lucide-react';
import { useLanguage } from '../../i18n';

type ChartType = 'bar' | 'line' | 'pie';

// 防抖的ResponsiveContainer，避免侧边栏动画时频繁重渲染
const DebouncedResponsiveContainer: React.FC<{ children: React.ReactNode; height: number }> = memo(({ children, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(updateWidth, 150); // 150ms防抖
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { observer.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      {width > 0 && <ResponsiveContainer width={width} height={height}>{children}</ResponsiveContainer>}
    </div>
  );
});

interface ChartDataItem {
  name: string;
  Demand: number;
  Stock: number;
  Production: number;
  TotalAvailable: number;
  Coverage: number;
}

interface InventoryChartProps {
  data: ChartDataItem[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const InventoryChart: React.FC<InventoryChartProps> = memo(({ data }) => {
  const { t } = useLanguage();
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showShortageOnly, setShowShortageOnly] = useState(false);

  const filteredData = useMemo(() => {
    const filtered = showShortageOnly ? data.filter(d => d.TotalAvailable < d.Demand) : [...data];
    return filtered.sort((a, b) => b.Demand - a.Demand); // 按需求量排序
  }, [data, showShortageOnly]);

  const shortageCount = useMemo(() => data.filter(d => d.TotalAvailable < d.Demand).length, [data]);

  // 饼图数据
  const pieData = useMemo(() => filteredData.map(d => ({ name: d.name, value: d.Demand })), [filteredData]);

  // 自定义Tooltip - 使用useCallback避免重复创建
  const CustomTooltip = useCallback(({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;
    const gap = item.Demand - item.TotalAvailable;
    const isShortage = gap > 0;
    return (
      <div className="bg-slate-800 text-white p-3 rounded-lg shadow-xl text-sm min-w-[160px]">
        <p className="font-bold text-base mb-2 border-b border-slate-600 pb-1">{label}</p>
        <div className="space-y-1">
          <p className="flex justify-between"><span className="text-red-400">{t('order_demand')}:</span><span className="font-mono">{item.Demand} t</span></p>
          <p className="flex justify-between"><span className="text-emerald-400">{t('current_stock')}:</span><span className="font-mono">{item.Stock} t</span></p>
          <p className="flex justify-between"><span className="text-blue-400">{t('today_capacity')}:</span><span className="font-mono">{item.Production} t</span></p>
          <p className="flex justify-between"><span className="text-green-400">{t('total_available')}:</span><span className="font-mono">{item.TotalAvailable} t</span></p>
          <div className="border-t border-slate-600 pt-1 mt-1">
            <p className={`flex justify-between font-bold ${isShortage ? 'text-red-400' : 'text-green-400'}`}>
              <span>{isShortage ? `${t('gap_label')}:` : `${t('surplus')}:`}</span>
              <span className="font-mono">{isShortage ? `-${gap.toFixed(1)}` : `+${Math.abs(gap).toFixed(1)}`} t</span>
            </p>
          </div>
        </div>
      </div>
    );
  }, [t]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('chart_title')}</h3>
        <div className="flex items-center space-x-2">
          {shortageCount > 0 && (
            <button onClick={() => setShowShortageOnly(!showShortageOnly)} className={`flex items-center px-2 py-1 rounded text-xs transition ${showShortageOnly ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              <TrendingDown size={12} className="mr-1" />{t('shortage')} ({shortageCount})
            </button>
          )}
          <div className="bg-slate-100 dark:bg-slate-700 rounded p-0.5 flex">
            <button onClick={() => setChartType('bar')} className={`p-1.5 rounded transition ${chartType === 'bar' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} title={t('chart_bar')}><BarChart3 size={14} /></button>
            <button onClick={() => setChartType('line')} className={`p-1.5 rounded transition ${chartType === 'line' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} title={t('chart_line')}><LineChartIcon size={14} /></button>
            <button onClick={() => setChartType('pie')} className={`p-1.5 rounded transition ${chartType === 'pie' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} title={t('chart_pie')}><PieChartIcon size={14} /></button>
          </div>
        </div>
      </div>

      <div className="h-[240px] min-w-0" style={{ contain: 'layout' }}>
        {filteredData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">{t('no_data')}</div>
        ) : chartType === 'bar' ? (
          <DebouncedResponsiveContainer height={240}>
            <BarChart data={filteredData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} interval={0} angle={filteredData.length > 5 ? -20 : 0} textAnchor={filteredData.length > 5 ? 'end' : 'middle'} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} tickFormatter={(v) => `${v}t`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', fillOpacity: 0.3 }} />
              <Legend verticalAlign="top" height={32} iconType="circle" iconSize={8} formatter={(value) => <span className="text-slate-600 dark:text-slate-300 text-xs ml-1">{value === 'Demand' ? t('order_demand') : value === 'TotalAvailable' ? t('total_available') : value}</span>} />
              <Bar dataKey="Demand" fill="#ef4444" radius={[4, 4, 0, 0]} name="Demand" maxBarSize={40} />
              <Bar dataKey="TotalAvailable" fill="#10b981" radius={[4, 4, 0, 0]} name="TotalAvailable" maxBarSize={40} />
            </BarChart>
          </DebouncedResponsiveContainer>
        ) : chartType === 'line' ? (
          <DebouncedResponsiveContainer height={240}>
            <LineChart data={filteredData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} tickFormatter={(v) => `${v}t`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={32} iconType="circle" iconSize={8} formatter={(value) => <span className="text-slate-600 dark:text-slate-300 text-xs ml-1">{value === 'Demand' ? t('order_demand') : value === 'TotalAvailable' ? t('total_available') : value}</span>} />
              <Line type="monotone" dataKey="Demand" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }} name="Demand" />
              <Line type="monotone" dataKey="TotalAvailable" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} name="TotalAvailable" />
            </LineChart>
          </DebouncedResponsiveContainer>
        ) : (
          <div className="flex h-full">
            <div className="flex-1 min-w-0">
              <DebouncedResponsiveContainer height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" label={false}>
                    {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} t`, t('order_demand')]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: '#1e293b', color: '#f1f5f9' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }} />
                </PieChart>
              </DebouncedResponsiveContainer>
            </div>
            <div className="w-32 flex flex-col justify-center space-y-2 pl-2">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex items-center text-xs">
                  <span className="w-3 h-3 rounded-sm mr-2 flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-slate-700 dark:text-slate-300 truncate flex-1" title={item.name}>{item.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono ml-1">{item.value}t</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

InventoryChart.displayName = 'InventoryChart';

export default InventoryChart;
