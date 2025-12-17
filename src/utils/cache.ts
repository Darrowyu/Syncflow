// 简易内存缓存，减少重复API请求
interface CacheItem<T> { data: T; timestamp: number }
const cache = new Map<string, CacheItem<unknown>>();
const DEFAULT_TTL = 30000; // 30秒缓存

export const cacheGet = <T>(key: string): T | null => {
  const item = cache.get(key) as CacheItem<T> | undefined;
  if (!item) return null;
  if (Date.now() - item.timestamp > DEFAULT_TTL) { cache.delete(key); return null; }
  return item.data;
};

export const cacheSet = <T>(key: string, data: T): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const cacheClear = (prefix?: string): void => {
  if (!prefix) { cache.clear(); return; }
  for (const key of cache.keys()) { if (key.startsWith(prefix)) cache.delete(key); }
};
