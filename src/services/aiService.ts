import { Order, OrderStatus, TradeType, ProductLine, InventoryItem, IncidentLog } from '../types';
import { generateId } from '../utils';
import { getAuthHeaders } from './authService';

// AI服务商类型
export type AIProvider = 'gemini' | 'deepseek';

// AI配置接口
export interface AIConfig {
  provider: AIProvider;
  keys?: { gemini?: string; deepseek?: string }; // 前端不再存储key，仅存储provider选择
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const AI_CONFIG_KEY = 'syncflow_ai_config';

// 获取AI配置（仅provider选择）
export const getAIConfig = (): AIConfig | null => {
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (!stored) return { provider: 'gemini' };
    return JSON.parse(stored);
  } catch { return { provider: 'gemini' }; }
};

// 保存AI配置（仅provider选择）
export const saveAIConfig = (config: AIConfig): void => {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ provider: config.provider }));
};

// 清除AI配置
export const clearAIConfig = (): void => {
  localStorage.removeItem(AI_CONFIG_KEY);
};

// 获取指定provider的key（已弃用，返回空字符串）
export const getProviderKey = (_provider: AIProvider): string => '';

// 通过后端代理调用AI
const callAI = async (prompt: string, jsonMode = false): Promise<string> => {
  const config = getAIConfig();
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ prompt, provider: config?.provider || 'gemini', jsonMode }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI服务错误: ${res.status}`);
  }
  const data = await res.json();
  return data.result || '';
};

// 1. 订单文本解析
export const parseOrderText = async (text: string): Promise<Partial<Order>[]> => {
  const prompt = `Extract order details from this text. Today is ${new Date().toISOString().split('T')[0]}. If date is missing, assume tomorrow. Return JSON format: {"orders":[{"client":"","styleNo":"","totalTons":0,"piNo":"","containers":0,"port":"","contactPerson":"","requirements":"","date":"YYYY-MM-DD"}]}. Text: "${text}"`;
  const response = await callAI(prompt, true);
  const result = JSON.parse(response || '{}');
  interface ParsedOrder {
    date?: string;
    client?: string;
    styleNo?: string;
    piNo?: string;
    totalTons?: number;
    containers?: number;
    packagesPerContainer?: number;
    port?: string;
    contactPerson?: string;
    requirements?: string;
  }

  return (result.orders || []).map((o: ParsedOrder) => ({
    id: generateId(),
    date: o.date || new Date().toISOString().split('T')[0],
    client: o.client || '',
    styleNo: o.styleNo || '',
    piNo: o.piNo || '',
    totalTons: o.totalTons || 0,
    containers: o.containers || 1,
    packagesPerContainer: o.packagesPerContainer || 30,
    port: o.port || '',
    contactPerson: o.contactPerson || '',
    requirements: o.requirements || '',
    tradeType: TradeType.GENERAL,
    status: OrderStatus.PENDING,
    isLargeOrder: (o.totalTons || 0) > 100,
    largeOrderAck: false,
  }));
};

// 2. 智能排产建议
export const getProductionSuggestion = async (orders: Order[], lines: ProductLine[], inventory: InventoryItem[]): Promise<string> => {
  const linesData = lines.map(l => {
    const hasSubLines = l.subLines && l.subLines.length > 0;
    const totalCap = hasSubLines ? l.subLines!.reduce((s, sub) => s + sub.dailyCapacity, 0) : l.dailyCapacity;
    const totalExport = hasSubLines ? l.subLines!.reduce((s, sub) => s + (sub.exportCapacity || 0), 0) : (l.exportCapacity || 0);
    const styles = hasSubLines ? l.subLines!.map(s => `${s.name}:${s.currentStyle}`).join(',') : l.currentStyle;
    return { name: l.name, status: l.status, styles, totalCapacity: totalCap, exportCapacity: totalExport };
  });
  const pendingOrders = orders.filter(o => o.status !== OrderStatus.SHIPPED).slice(0, 15);
  const prompt = `作为生产调度专家，分析SyncFlow系统数据并给出排产建议：

【待发订单】
${pendingOrders.map(o => `- ${o.client}: ${o.styleNo} ${o.totalTons}t, 交期${o.date}`).join('\n')}

【产线状态】
${linesData.map(l => `- ${l.name}(${l.status}): 款号${l.styles}, 产能${l.totalCapacity}t/日, 外贸${l.exportCapacity}t`).join('\n')}

【库存情况】
${inventory.map(i => `- ${i.styleNo}: 库存${i.stockTMinus1}t, 已锁定${i.lockedForToday}t`).join('\n')}

请分析：1.产能与订单匹配度 2.瓶颈款号及建议 3.产线调整建议。用中文简洁回答。`;
  return await callAI(prompt) || '无法生成建议';
};

// 3. 库存预警分析
export const getInventoryAnalysis = async (orders: Order[], inventory: InventoryItem[], lines: ProductLine[]): Promise<string> => {
  const pendingOrders = orders.filter(o => o.status !== OrderStatus.SHIPPED);
  const ordersByStyle: Record<string, number> = {};
  pendingOrders.forEach(o => { ordersByStyle[o.styleNo] = (ordersByStyle[o.styleNo] || 0) + o.totalTons; });
  const capacityByStyle: Record<string, number> = {};
  lines.filter(l => l.status === 'Running').forEach(l => {
    if (l.subLines && l.subLines.length > 0) {
      l.subLines.forEach(sub => { if (sub.currentStyle && sub.currentStyle !== '-') capacityByStyle[sub.currentStyle] = (capacityByStyle[sub.currentStyle] || 0) + sub.dailyCapacity; });
    } else if (l.currentStyle && l.currentStyle !== '-') capacityByStyle[l.currentStyle] = (capacityByStyle[l.currentStyle] || 0) + l.dailyCapacity;
  });
  const prompt = `作为库存分析专家，分析SyncFlow系统数据：

【库存状态】
${inventory.map(i => `- ${i.styleNo}: 可用${i.stockTMinus1 - i.lockedForToday}t (总${i.stockTMinus1}t, 锁定${i.lockedForToday}t)`).join('\n')}

【待发需求】
${Object.entries(ordersByStyle).map(([style, tons]) => `- ${style}: 需${tons}t`).join('\n')}

【日产能】
${Object.entries(capacityByStyle).map(([style, cap]) => `- ${style}: ${cap}t/日`).join('\n')}

请分析：1.库存紧张款号 2.预计缺口及补货天数 3.优先级建议。用中文简洁回答。`;
  return await callAI(prompt) || '无法生成分析';
};

// 4. 异常原因分析
export const getIncidentAnalysis = async (incidents: IncidentLog[]): Promise<string> => {
  if (incidents.length === 0) return '暂无异常记录';
  const prompt = `分析以下仓库异常记录，总结问题模式并提出改进建议：
${JSON.stringify(incidents.map(i => ({ date: i.timestamp, style: i.styleNo, reason: i.reason, note: i.note })))}
请给出：1.异常类型分布 2.高频问题款号 3.根本原因分析 4.改进建议。用中文回答。`;
  return await callAI(prompt) || '无法生成分析';
};

// 5. 发货优先级排序
export const getShippingPriority = async (orders: Order[], inventory: InventoryItem[]): Promise<string> => {
  const pending = orders.filter(o => o.status !== OrderStatus.SHIPPED);
  const inventoryMap: Record<string, number> = {};
  inventory.forEach(i => { inventoryMap[i.styleNo] = i.stockTMinus1 - i.lockedForToday; });
  const prompt = `作为物流调度专家，为SyncFlow系统订单排定发货优先级：

【待发订单】
${pending.map(o => {
    const stock = inventoryMap[o.styleNo] || 0;
    const stockStatus = stock >= o.totalTons ? '✓充足' : `⚠缺${(o.totalTons - stock).toFixed(1)}t`;
    return `- ${o.client} | ${o.styleNo} ${o.totalTons}t | 交期${o.date} | ${o.isLargeOrder ? '大单' : '常规'} | 库存${stockStatus}`;
  }).join('\n')}

【排序依据】1.交期紧迫度 2.库存充足度 3.大单优先 4.保税订单优先

请给出：1.建议发货顺序 2.每单理由 3.风险提示。用中文简洁回答。`;
  return await callAI(prompt) || '无法生成排序';
};

// 6. 自然语言查询
export const queryWithAI = async (question: string, context: { orders: Order[]; lines: ProductLine[]; inventory: InventoryItem[]; incidents: IncidentLog[] }): Promise<string> => {
  const linesData = context.lines.map(l => {
    const hasSubLines = l.subLines && l.subLines.length > 0;
    const totalCap = hasSubLines ? l.subLines!.reduce((s, sub) => s + sub.dailyCapacity, 0) : l.dailyCapacity;
    const totalExport = hasSubLines ? l.subLines!.reduce((s, sub) => s + (sub.exportCapacity || 0), 0) : (l.exportCapacity || 0);
    return { name: l.name, status: l.status, style: hasSubLines ? l.subLines!.map(s => s.currentStyle).join('/') : l.currentStyle, capacity: totalCap, export: totalExport };
  });
  const prompt = `你是SyncFlow产销协同系统的AI助手，帮助用户分析生产、库存、订单数据。

【系统数据摘要】
- 产线${context.lines.length}条，运行中${context.lines.filter(l => l.status === 'Running').length}条
- 待发订单${context.orders.filter(o => o.status !== 'Shipped').length}个
- 库存款号${context.inventory.length}种

【产线详情】
${linesData.map(l => `${l.name}(${l.status}): ${l.style}, 产能${l.capacity}t, 外贸${l.export}t`).join('\n')}

【库存详情】
${context.inventory.map(i => `${i.styleNo}: ${i.stockTMinus1}t (锁定${i.lockedForToday}t)`).join('\n')}

【近期订单】
${context.orders.slice(0, 10).map(o => `${o.client}: ${o.styleNo} ${o.totalTons}t, ${o.status}`).join('\n')}

用户问题：${question}

请用中文简洁回答，给出具体数据支撑。`;
  return await callAI(prompt) || '无法回答该问题';
};
