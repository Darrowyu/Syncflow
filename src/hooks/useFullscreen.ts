import { useState, useCallback } from 'react';

export function useFullscreen() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleFullscreen = useCallback(() => setIsCollapsed(prev => !prev), []);
  return { isFullscreen: isCollapsed, toggleFullscreen };
}
