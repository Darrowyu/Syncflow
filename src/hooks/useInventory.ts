import { useState, useCallback } from 'react';
import { InventoryItem, IncidentLog } from '../types';
import { generateId } from '../utils';

export const useInventory = (initialInventory: InventoryItem[], initialIncidents: IncidentLog[]) => {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [incidents, setIncidents] = useState<IncidentLog[]>(initialIncidents);

  const updateInventory = useCallback((styleNo: string, updates: Partial<InventoryItem>) => { // 更新库存
    setInventory(prev => prev.map(i => i.styleNo === styleNo ? { ...i, ...updates } : i));
  }, []);

  const logIncident = useCallback((incident: Omit<IncidentLog, 'id' | 'timestamp'>) => { // 记录异常
    const newIncident: IncidentLog = { ...incident, id: generateId(), timestamp: new Date().toLocaleString() };
    setIncidents(prev => [newIncident, ...prev]);
  }, []);

  const getStock = useCallback((styleNo: string): number => { // 获取某款号库存
    return inventory.find(i => i.styleNo === styleNo)?.stockTMinus1 || 0;
  }, [inventory]);

  return { inventory, setInventory, incidents, setIncidents, updateInventory, logIncident, getStock };
};
