import { useState, useCallback, useMemo } from 'react';
import { Order, OrderStatus, InventoryItem, ProductLine } from '../types';
import { calculateFulfillment, getPendingOrders, getCriticalAlerts, FulfillmentResult } from '../utils';

export const useOrders = (initialOrders: Order[]) => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  const addOrders = useCallback((newOrders: Order[]) => { // 批量添加订单
    setOrders(prev => [...prev, ...newOrders]);
  }, []);

  const acknowledgeOrder = useCallback((orderId: string) => { // 确认大货订单
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, largeOrderAck: true } : o));
  }, []);

  const confirmLoad = useCallback((orderId: string) => { // 确认装车
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.SHIPPED } : o));
  }, []);

  const pendingOrders = useMemo(() => getPendingOrders(orders), [orders]); // 待处理订单
  const criticalAlerts = useMemo(() => getCriticalAlerts(orders), [orders]); // 大货预警
  const confirmedOrders = useMemo(() => orders.filter(o => o.status === OrderStatus.CONFIRMED), [orders]); // 待装车订单

  const getFulfillment = useCallback((order: Order, inventory: InventoryItem[], lines: ProductLine[]): FulfillmentResult => { // 获取订单满足率
    return calculateFulfillment(order, inventory, lines);
  }, []);

  return { orders, setOrders, addOrders, acknowledgeOrder, confirmLoad, pendingOrders, criticalAlerts, confirmedOrders, getFulfillment };
};
