// 防抖函数 - 防止重复提交
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// 节流函数 - 限制执行频率
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number = 300): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 防重复点击 - 返回Promise的函数专用
export function preventDoubleClick<T extends (...args: any[]) => Promise<any>>(fn: T): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let pending = false;
  return async (...args: Parameters<T>) => {
    if (pending) return undefined;
    pending = true;
    try { return await fn(...args); }
    finally { pending = false; }
  };
}
