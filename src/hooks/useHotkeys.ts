import { useState, useEffect, useCallback } from 'react';

// 快捷键动作类型
export type HotkeyAction = 'dashboard' | 'orders' | 'production' | 'warehouse' | 'help' | 'toggleTheme' | 'toggleAI' | 'toggleSettings';

// 快捷键配置
export interface HotkeyConfig {
  action: HotkeyAction;
  key: string; // 如 'ctrl+shift+d'
  label: string;
}

// 浏览器常用快捷键（冲突检测用）
const BROWSER_HOTKEYS = [
  'ctrl+d', 'ctrl+s', 'ctrl+p', 'ctrl+n', 'ctrl+t', 'ctrl+w', 'ctrl+r', 'ctrl+f', 'ctrl+h', 'ctrl+j', 'ctrl+l', 'ctrl+o', 'ctrl+u',
  'alt+d', 'alt+f', 'alt+e', 'alt+v', 'alt+h', 'alt+left', 'alt+right', 'f1', 'f3', 'f5', 'f6', 'f7', 'f11', 'f12',
  'ctrl+shift+i', 'ctrl+shift+j', 'ctrl+shift+c', 'ctrl+shift+n', 'ctrl+shift+t', 'ctrl+shift+delete',
];

// 默认快捷键配置
const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  { action: 'dashboard', key: 'ctrl+1', label: '仪表盘' },
  { action: 'orders', key: 'ctrl+2', label: '订单管理' },
  { action: 'production', key: 'ctrl+3', label: '排产控制' },
  { action: 'warehouse', key: 'ctrl+4', label: '仓库作业' },
  { action: 'help', key: 'ctrl+5', label: '使用指南' },
  { action: 'toggleTheme', key: 'ctrl+shift+d', label: '切换主题' },
  { action: 'toggleAI', key: 'ctrl+shift+a', label: 'AI助手' },
  { action: 'toggleSettings', key: 'ctrl+shift+s', label: '设置' },
];

const STORAGE_KEY = 'syncflow_hotkeys';

// 解析快捷键字符串为事件匹配对象
const parseHotkey = (key: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } => {
  const parts = key.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter(p => !['ctrl', 'shift', 'alt'].includes(p))[0] || '',
  };
};

// 检查事件是否匹配快捷键
const matchHotkey = (e: KeyboardEvent, hotkey: string): boolean => {
  const parsed = parseHotkey(hotkey);
  return e.ctrlKey === parsed.ctrl && e.shiftKey === parsed.shift && e.altKey === parsed.alt && e.key.toLowerCase() === parsed.key;
};

// 检测快捷键是否与浏览器冲突
export const checkConflict = (key: string): { conflict: boolean; message: string } => {
  const normalized = key.toLowerCase();
  if (BROWSER_HOTKEYS.includes(normalized)) {
    return { conflict: true, message: '与浏览器快捷键冲突' };
  }
  return { conflict: false, message: '' };
};

// 格式化快捷键显示
export const formatHotkey = (key: string): string => {
  return key.split('+').map(p => {
    if (p === 'ctrl') return 'Ctrl';
    if (p === 'shift') return 'Shift';
    if (p === 'alt') return 'Alt';
    return p.toUpperCase();
  }).join(' + ');
};

// 从键盘事件生成快捷键字符串
export const eventToHotkey = (e: KeyboardEvent): string | null => {
  const key = e.key.toLowerCase();
  if (['control', 'shift', 'alt', 'meta'].includes(key)) return null; // 忽略单独的修饰键
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  if (parts.length === 0) return null; // 必须有修饰键
  parts.push(key);
  return parts.join('+');
};

export const useHotkeys = (handlers: Partial<Record<HotkeyAction, () => void>>) => {
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_HOTKEYS;
  });

  // 保存配置
  const saveHotkeys = useCallback((newHotkeys: HotkeyConfig[]) => {
    setHotkeys(newHotkeys);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHotkeys));
  }, []);

  // 更新单个快捷键
  const updateHotkey = useCallback((action: HotkeyAction, newKey: string): { success: boolean; message: string } => {
    const conflict = checkConflict(newKey);
    if (conflict.conflict) return { success: false, message: conflict.message };
    const duplicate = hotkeys.find(h => h.key === newKey && h.action !== action);
    if (duplicate) return { success: false, message: `与"${duplicate.label}"冲突` };
    const newHotkeys = hotkeys.map(h => h.action === action ? { ...h, key: newKey } : h);
    saveHotkeys(newHotkeys);
    return { success: true, message: '已保存' };
  }, [hotkeys, saveHotkeys]);

  // 重置为默认
  const resetHotkeys = useCallback(() => { saveHotkeys(DEFAULT_HOTKEYS); }, [saveHotkeys]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      for (const hk of hotkeys) {
        if (matchHotkey(e, hk.key) && handlers[hk.action]) {
          e.preventDefault();
          handlers[hk.action]!();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys, handlers]);

  return { hotkeys, updateHotkey, resetHotkeys, formatHotkey };
};
