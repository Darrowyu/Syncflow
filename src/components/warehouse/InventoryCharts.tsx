import React, { useMemo, memo, useRef, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Warehouse, TrendingUp, AlertTriangle } from 'lucide-react';
import { InventoryItem, WarehouseType } from '../../types';
import { useLanguage } from '../../i18n';

// 防抖的ResponsiveContainer
const DebouncedChart: React.FC<{ children: React.ReactNode; height: number }> = memo(({ children, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(200);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const updateWidth = () => { if (containerRef.current) setWidth(containerRef.current.offsetWidth); };
    updateWidth();
    const observer = new ResizeObserver(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(updateWidth, 150);
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { observer.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
  return <div ref={containerRef} style={{ width: '100%', height }}>{width > 0 && <ResponsiveContainer width={width} height={height}>{children}</ResponsiveContainer>}</div>;
});

interface InventoryChartsProps {
  inventory: InventoryItem[];
}

const InventoryCharts: React.FC<InventoryChartsProps> = memo(({ inventory }) => {
  const { t } = useLanguage();

  // 统计数据
  const stats = useMemo(() => {
    const total = inventory.reduce((sum, i) => sum + i.currentStock, 0);
    const general = inventory.filter(i => i.warehouseType === WarehouseType.GENERAL).reduce((sum, i) => sum + i.currentStock, 0);
    const bonded = inventory.filter(i => i.warehouseType === WarehouseType.BONDED).reduce((sum, i) => sum + i.currentStock, 0);
    const locked = inventory.reduce((sum, i) => sum + (i.lockedForToday || 0), 0);
    const belowSafety = inventory.filter(i => i.safetyStock && i.currentStock < i.safetyStock).length;
    return { total, general, bonded, locked, available: total - locked, belowSafety };
  }, [inventory]);

  // 按款号分组
  const byStyle = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach(i => map.set(i.styleNo, (map.get(i.styleNo) || 0) + i.currentStock));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [inventory]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0].payload;
    return (
      <div className="bg-slate-800 text-white p-2 rounded-lg shadow-lg text-sm">
        <p className="font-medium">{name}</p>
        <p className="font-mono">{value.toFixed(1)} t</p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
      {/* 统计卡片 */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <Package size={16} className="text-blue-500" />
          <span className="text-xs text-slate-400">{t('inv_current_stock')}</span>
        </div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.total.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">t</span></p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <Warehouse size={16} className="text-slate-500" />
          <span className="text-xs text-slate-400">{t('wh_general')}</span>
        </div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.general.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">t</span></p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <Warehouse size={16} className="text-blue-500" />
          <span className="text-xs text-slate-400">{t('wh_bonded')}</span>
        </div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.bonded.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">t</span></p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <TrendingUp size={16} className="text-green-500" />
          <span className="text-xs text-slate-400">{t('inv_available')}</span>
        </div>
        <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.available.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">t</span></p>
      </div>
      {/* 按款号柱状图 */}
      <div className="col-span-2 md:col-span-2 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('table_style')}</span>
          {stats.belowSafety > 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded flex items-center"><AlertTriangle size={10} className="mr-0.5" />{stats.belowSafety}</span>}
        </div>
        <div className="h-[80px] min-w-0">
          {byStyle.length > 0 ? (
            <DebouncedChart height={80}>
              <BarChart data={byStyle} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={24} />
              </BarChart>
            </DebouncedChart>
          ) : <div className="h-full flex items-center justify-center text-slate-400 text-xs">{t('no_data')}</div>}
        </div>
      </div>
    </div>
  );
});

InventoryCharts.displayName = 'InventoryCharts';
export default InventoryCharts;
