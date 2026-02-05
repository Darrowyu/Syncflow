// 应用全局配置 - 集中管理魔法数字和业务常量

// ========== 业务阈值 ==========
export const LARGE_ORDER_THRESHOLD = 100; // 大单吨数阈值
export const DEFAULT_PACKAGES_PER_CONTAINER = 30; // 默认每柜包数
export const DEFAULT_CONTAINERS = 1; // 默认柜数

// ========== 缓存配置 ==========
export const CACHE_TTL = {
    inventory: 15000,  // 库存缓存15秒
    orders: 30000,     // 订单缓存30秒
    lines: 60000,      // 产线缓存60秒
    styles: 120000,    // 款号缓存120秒
    incidents: 30000,  // 异常日志缓存30秒
    default: 30000,    // 默认缓存30秒
} as const;

export const CACHE_MAX_SIZE = 1000; // 缓存最大条目数，防止内存溢出

// ========== 分页配置 ==========
export const PAGINATION = {
    defaultPageSize: 50,    // 默认每页条数
    transactionPageSize: 50, // 流水记录每页条数
    auditLogPageSize: 50,   // 审计日志每页条数
} as const;

// ========== 日期格式 ==========
export const DATE_FORMAT = {
    display: 'zh-CN',      // 显示用的时区
    timezone: 'Asia/Shanghai', // 服务器时区
} as const;

// ========== 订单状态颜色映射 ==========
export const STATUS_COLORS = {
    Pending: 'bg-yellow-100 text-yellow-700',
    InProduction: 'bg-blue-100 text-blue-700',
    ReadyToShip: 'bg-green-100 text-green-700',
    Shipped: 'bg-slate-100 text-slate-500',
    Confirmed: 'bg-blue-100 text-blue-700',
    Delayed: 'bg-red-100 text-red-700',
} as const;

// ========== 产线状态颜色映射 ==========
export const LINE_STATUS_COLORS = {
    Running: 'bg-green-100 text-green-700',
    Maintenance: 'bg-yellow-100 text-yellow-700',
    Stopped: 'bg-slate-100 text-slate-500',
} as const;
