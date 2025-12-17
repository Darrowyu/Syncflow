import { useState, useCallback, useMemo } from 'react';
import { ProductLine, LineStatus } from '../types';
import { calculateExportCapacity } from '../utils';

export const useProduction = (initialLines: ProductLine[]) => {
  const [lines, setLines] = useState<ProductLine[]>(initialLines);

  const updateLine = useCallback((lineId: number, updates: Partial<ProductLine>) => { // 更新产线配置
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, ...updates } : l));
  }, []);

  const activeLines = useMemo(() => lines.filter(l => l.status === LineStatus.RUNNING), [lines]); // 运行中产线
  const totalExportCapacity = useMemo(() => lines.reduce((sum, l) => sum + calculateExportCapacity(l), 0), [lines]); // 总外贸产能

  return { lines, setLines, updateLine, activeLines, totalExportCapacity };
};
