import React, { useState, useMemo, useCallback, memo } from 'react';
import { Order, OrderStatus } from '../../types';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import { useLanguage } from '../../i18n';

type ViewMode = 'month' | 'week';

interface OrderCalendarProps {
    orders: Order[];
    onSelectOrder?: (order: Order) => void;
    onCreateOrder?: (date: string) => void; // 新建订单回调
}

const OrderCalendar: React.FC<OrderCalendarProps> = memo(({ orders, onSelectOrder, onCreateOrder }) => {
    const { language, t } = useLanguage();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [dragOrder, setDragOrder] = useState<Order | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weeks = Math.ceil((daysInMonth + firstDayOfMonth) / 7);

    // 周视图：获取当前周的日期范围
    const weekDates = useMemo(() => {
        const day = currentDate.getDay();
        const start = new Date(currentDate);
        start.setDate(currentDate.getDate() - day);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const ordersByDate = useMemo(() => {
        const map: Record<string, Order[]> = {};
        orders.filter(o => o.expectedShipDate).forEach(order => {
            const dateKey = order.expectedShipDate!;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(order);
        });
        return map;
    }, [orders]);

    // 计算每日总吨数
    const tonsByDate = useMemo(() => {
        const map: Record<string, number> = {};
        Object.entries(ordersByDate).forEach(([date, dayOrders]) => {
            map[date] = dayOrders.reduce((sum, o) => sum + o.totalTons, 0);
        });
        return map;
    }, [ordersByDate]);

    const prevPeriod = () => setCurrentDate(prev => {
        const d = new Date(prev);
        viewMode === 'month' ? d.setMonth(d.getMonth() - 1) : d.setDate(d.getDate() - 7);
        return d;
    });
    const nextPeriod = () => setCurrentDate(prev => {
        const d = new Date(prev);
        viewMode === 'month' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 7);
        return d;
    });
    const goToday = () => setCurrentDate(new Date());

    // 拖拽处理
    const handleDragStart = useCallback((e: React.DragEvent, order: Order) => {
        setDragOrder(order);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, dateStr: string) => {
        e.preventDefault();
        if (dragOrder && onSelectOrder) {
            onSelectOrder({ ...dragOrder, expectedShipDate: dateStr }); // 触发编辑弹窗，预填新日期
        }
        setDragOrder(null);
    }, [dragOrder, onSelectOrder]);

    const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

    const getStatusColor = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.READY_TO_SHIP: return 'bg-green-500';
            case OrderStatus.SHIPPED: return 'bg-slate-400';
            case OrderStatus.IN_PRODUCTION: return 'bg-blue-500';
            default: return 'bg-amber-500';
        }
    };

    const monthNames = language === 'zh'
        ? ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayNames = language === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const formatDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // 渲染单个日期格子
    const renderDayCell = (dateStr: string, dayNum: number, isCurrentMonth: boolean, isToday: boolean, minHeight: string) => {
        const dayOrders = dateStr ? ordersByDate[dateStr] || [] : [];
        const dayTons = tonsByDate[dateStr] || 0;
        return (
            <div 
                key={dateStr || dayNum}
                className={`${minHeight} border-r border-b border-slate-100 dark:border-slate-700 p-1 ${!isCurrentMonth ? 'bg-slate-50 dark:bg-slate-900/50' : ''} ${isToday ? 'bg-blue-50 dark:bg-blue-900/30' : ''} ${dragOrder ? 'hover:bg-blue-50 dark:hover:bg-blue-900/30' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => dateStr && handleDrop(e, dateStr)}
            >
                {isCurrentMonth && (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>{dayNum}</span>
                            <div className="flex items-center space-x-1">
                                {dayTons > 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{dayTons.toFixed(1)}t</span>}
                                {onCreateOrder && (
                                    <button onClick={() => onCreateOrder(dateStr)} className="p-0.5 text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400" title="新建订单">
                                        <Plus size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className={`space-y-0.5 overflow-y-auto ${viewMode === 'week' ? 'max-h-[200px]' : 'max-h-[60px]'}`}>
                            {dayOrders.slice(0, viewMode === 'week' ? 10 : 3).map(order => (
                                <div 
                                    key={order.id} 
                                    draggable 
                                    onDragStart={(e) => handleDragStart(e, order)}
                                    onClick={() => onSelectOrder?.(order)} 
                                    className="flex items-center px-1 py-0.5 rounded text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 truncate"
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0 ${getStatusColor(order.status)}`}></span>
                                    <span className="truncate text-slate-700 dark:text-slate-300">{order.client}</span>
                                    <span className="ml-auto text-slate-400 dark:text-slate-500 font-mono text-[10px]">{order.totalTons}t</span>
                                </div>
                            ))}
                            {dayOrders.length > (viewMode === 'week' ? 10 : 3) && (
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">+{dayOrders.length - (viewMode === 'week' ? 10 : 3)} more</div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-4">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center">
                        <Calendar size={20} className="mr-2 text-blue-500" />
                        {t('shipping_calendar')}
                    </h3>
                    <button onClick={goToday} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300">
                        {t('today_btn')}
                    </button>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded p-0.5 flex text-xs">
                        <button onClick={() => setViewMode('month')} className={`px-2 py-1 rounded transition ${viewMode === 'month' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{t('month_view')}</button>
                        <button onClick={() => setViewMode('week')} className={`px-2 py-1 rounded transition ${viewMode === 'week' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{t('week_view')}</button>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={prevPeriod} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" /></button>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">
                        {viewMode === 'month' ? `${monthNames[month]} ${year}` : `${weekDates[0].getMonth() + 1}/${weekDates[0].getDate()} - ${weekDates[6].getMonth() + 1}/${weekDates[6].getDate()}`}
                    </span>
                    <button onClick={nextPeriod} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronRight size={20} className="text-slate-600 dark:text-slate-400" /></button>
                </div>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
                {dayNames.map(day => (
                    <div key={day} className="py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900">{day}</div>
                ))}
            </div>
            {viewMode === 'month' ? (
                <div className="grid grid-cols-7">
                    {Array.from({ length: weeks * 7 }).map((_, idx) => {
                        const dayNum = idx - firstDayOfMonth + 1;
                        const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                        const dateStr = isCurrentMonth ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}` : '';
                        const isToday = dateStr === todayStr;
                        return renderDayCell(dateStr, dayNum, isCurrentMonth, isToday, 'min-h-[80px]');
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-7">
                    {weekDates.map((d) => {
                        const dateStr = formatDateStr(d);
                        const isToday = dateStr === todayStr;
                        return renderDayCell(dateStr, d.getDate(), true, isToday, 'min-h-[250px]');
                    })}
                </div>
            )}
            <div className="flex items-center justify-center space-x-6 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                {[{ status: OrderStatus.PENDING, label: t('status_pending'), color: 'bg-amber-500' }, { status: OrderStatus.IN_PRODUCTION, label: t('status_in_production'), color: 'bg-blue-500' }, { status: OrderStatus.READY_TO_SHIP, label: t('status_ready_to_ship'), color: 'bg-green-500' }, { status: OrderStatus.SHIPPED, label: t('status_shipped'), color: 'bg-slate-400' }].map(item => (
                    <div key={item.status} className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                        <span className={`w-2 h-2 rounded-full mr-1 ${item.color}`}></span>{item.label}
                    </div>
                ))}
            </div>
        </div>
    );
});

OrderCalendar.displayName = 'OrderCalendar';

export default OrderCalendar;
