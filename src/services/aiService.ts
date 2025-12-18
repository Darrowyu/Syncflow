import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Order, OrderStatus, TradeType, ProductLine, InventoryItem, IncidentLog } from '../types';
import { generateId } from '../utils';

// AI服务商类型
export type AIProvider = 'gemini' | 'deepseek';

// AI配置接口（每个provider独立存储key）
export interface AIConfig {
  provider: AIProvider;
  keys: { gemini?: string; deepseek?: string };
}

// localStorage存储键
const AI_CONFIG_KEY = 'syncflow_ai_config';

// 获取AI配置
export const getAIConfig = (): AIConfig | null => {
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.apiKey) return { provider: parsed.provider, keys: { [parsed.provider]: parsed.apiKey } }; // 兼容旧格式
    return parsed;
  } catch { return null; }
};

// 保存AI配置
export const saveAIConfig = (config: AIConfig): void => {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
};

// 清除AI配置
export const clearAIConfig = (): void => {
  localStorage.removeItem(AI_CONFIG_KEY);
};

// 获取指定provider的key
export const getProviderKey = (provider: AIProvider): string => {
  const config = getAIConfig();
  return config?.keys?.[provider] || '';
};

// 获取有效的API Key（优先用户配置，其次环境变量）
const getEffectiveConfig = (): { provider: AIProvider; apiKey: string } => {
  const userConfig = getAIConfig();
  const currentKey = userConfig?.keys?.[userConfig.provider];
  if (userConfig && currentKey) return { provider: userConfig.provider, apiKey: currentKey };
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey) return { provider: 'gemini', apiKey: envKey };
  throw new Error('AI API Key未配置，请在设置中配置API Key');
};

// DeepSeek API调用
const callDeepSeek = async (apiKey: string, prompt: string, jsonMode = false): Promise<string> => {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API错误: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
};

// Gemini API调用
const callGemini = async (apiKey: string, prompt: string, schema?: Schema): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const config = schema ? { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 } : { temperature: 0.1 };
  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config });
  return response.text || '';
};

// 统一AI调用接口
const callAI = async (prompt: string, jsonMode = false, schema?: Schema): Promise<string> => {
  const config = getEffectiveConfig();
  if (config.provider === 'deepseek') return callDeepSeek(config.apiKey, prompt, jsonMode);
  return callGemini(config.apiKey, prompt, schema);
};

// 订单解析Schema
const OrderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    orders: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          client: { type: Type.STRING }, styleNo: { type: Type.STRING }, piNo: { type: Type.STRING },
          totalTons: { type: Type.NUMBER }, containers: { type: Type.NUMBER }, port: { type: Type.STRING },
          contactPerson: { type: Type.STRING }, requirements: { type: Type.STRING },
          date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
        },
        required: ['client', 'styleNo', 'totalTons'],
      },
    },
  },
};

// 1. 订单文本解析
export const parseOrderText = async (text: string): Promise<Partial<Order>[]> => {
  const config = getEffectiveConfig();
  const prompt = `Extract order details from this text. Today is ${new Date().toISOString().split('T')[0]}. If date is missing, assume tomorrow. Return JSON format: {"orders":[{"client":"","styleNo":"","totalTons":0,"piNo":"","containers":0,"port":"","contactPerson":"","requirements":"","date":"YYYY-MM-DD"}]}. Text: "${text}"`;
  const response = config.provider === 'deepseek' 
    ? await callDeepSeek(config.apiKey, prompt, true)
    : await callGemini(config.apiKey, prompt, OrderSchema);
  const result = JSON.parse(response || '{}');
  return (result.orders || []).map((o: Record<string, unknown>) => ({
    id: generateId(),
    date: (o.date as string) || new Date().toISOString().split('T')[0],
    client: (o.client as string) || '',
    styleNo: (o.styleNo as string) || '',
    piNo: (o.piNo as string) || '',
    totalTons: (o.totalTons as number) || 0,
    containers: (o.containers as number) || 1,
    packagesPerContainer: (o.packagesPerContainer as number) || 30,
    port: (o.port as string) || '',
    contactPerson: (o.contactPerson as string) || '',
    requirements: (o.requirements as string) || '',
    tradeType: TradeType.GENERAL,
    status: OrderStatus.PENDING,
    isLargeOrder: ((o.totalTons as number) || 0) > 100,
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
${pendingOrders.map(o => `- ${o.client}: ${o.styleNo} ${o.totalTons}t, 交期${o.expectedShipDate || o.date}`).join('\n')}

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
    return `- ${o.client} | ${o.styleNo} ${o.totalTons}t | 交期${o.expectedShipDate || o.date} | ${o.isLargeOrder ? '大单' : '常规'} | 库存${stockStatus}`;
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
