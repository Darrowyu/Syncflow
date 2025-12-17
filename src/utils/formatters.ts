export const formatTons = (value: number, decimals = 1): string => `${value.toFixed(decimals)}t`; // 格式化吨数

export const formatPercent = (value: number, decimals = 0): string => `${value.toFixed(decimals)}%`; // 格式化百分比

export const formatDate = (date: string, locale: string = 'zh-CN'): string => { // 格式化日期
  return new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
};

export const generateId = (): string => Math.random().toString(36).substr(2, 9); // 生成随机ID
