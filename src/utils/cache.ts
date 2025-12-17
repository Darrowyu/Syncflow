// 细粒度内存缓存，减少重复API请求
interface CacheItem<T> { data: T; timestamp: number; ttl: number }
const cache = new Map<string, CacheItem<unknown>>();
const DEFAULT_TTL = 30000; // 30秒缓存
const TTL_CONFIG: Record<string, number> = { inventory: 15000, orders: 30000, lines: 60000, styles: 120000, incidents: 30000 }; // 不同数据类型的缓存时间

export const cacheGet = <T>(key: string): T | null => {
  const item = cache.get(key) as CacheItem<T> | undefined;
  if (!item) return null;
  if (Date.now() - item.timestamp > item.ttl) { cache.delete(key); return null; }
  return item.data;
};

export const cacheSet = <T>(key: string, data: T, customTtl?: number): void => {
  const ttl = customTtl || TTL_CONFIG[key] || DEFAULT_TTL;
  cache.set(key, { data, timestamp: Date.now(), ttl });
};

export const cacheClear = (prefix?: string): void => {
  if (!prefix) { cache.clear(); return; }
  for (const key of cache.keys()) { if (key.startsWith(prefix)) cache.delete(key); }
};

export const cacheInvalidate = (keys: string[]): void => { // 精确失效指定缓存
  keys.forEach(key => cache.delete(key));
};

export const getCacheStats = (): { size: number; keys: string[] } => ({ size: cache.size, keys: Array.from(cache.keys()) });
