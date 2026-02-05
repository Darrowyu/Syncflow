// 细粒度内存缓存，减少重复API请求 - 带LRU淘汰机制
import { CACHE_TTL, CACHE_MAX_SIZE } from '../constants/config';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  lastAccessed: number; // 用于LRU淘汰
}

const cache = new Map<string, CacheItem<unknown>>();

// 获取当前时间戳
const now = (): number => Date.now();

// LRU淘汰：当缓存超过限制时，移除最久未访问的条目
const evictLRU = (): void => {
  if (cache.size <= CACHE_MAX_SIZE) return;

  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, item] of cache.entries()) {
    if (item.lastAccessed < oldestTime) {
      oldestTime = item.lastAccessed;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
    console.log(`[Cache] LRU evicted: ${oldestKey}`);
  }
};

export const cacheGet = <T>(key: string): T | null => {
  const item = cache.get(key) as CacheItem<T> | undefined;
  if (!item) return null;

  // 检查是否过期
  if (Date.now() - item.timestamp > item.ttl) {
    cache.delete(key);
    return null;
  }

  // 更新最后访问时间
  item.lastAccessed = Date.now();
  return item.data;
};

export const cacheSet = <T>(key: string, data: T, customTtl?: number): void => {
  const ttl = customTtl || (CACHE_TTL as Record<string, number>)[key] || CACHE_TTL.default;

  // 如果缓存已满且是新增条目，先执行LRU淘汰
  if (!cache.has(key) && cache.size >= CACHE_MAX_SIZE) {
    evictLRU();
  }

  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
    lastAccessed: Date.now(),
  });
};

export const cacheClear = (prefix?: string): void => {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
};

export const cacheInvalidate = (keys: string[]): void => {
  // 精确失效指定缓存
  keys.forEach(key => cache.delete(key));
};

export const getCacheStats = (): { size: number; maxSize: number; keys: string[] } => ({
  size: cache.size,
  maxSize: CACHE_MAX_SIZE,
  keys: Array.from(cache.keys()),
});
