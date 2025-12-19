export { useData } from './useData';
export { useFullscreen } from './useFullscreen';
export { useIsMobile } from './useIsMobile';
export { useHotkeys, formatHotkey, eventToHotkey, checkConflict } from './useHotkeys';
export type { HotkeyAction, HotkeyConfig } from './useHotkeys';
// 以下hooks保留用于独立场景，主应用使用useData统一管理
export { useOrders } from './useOrders';
export { useProduction } from './useProduction';
export { useInventory } from './useInventory';
