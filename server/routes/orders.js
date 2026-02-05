import { Router } from 'express';

const router = Router();

// 字段映射配置
const FIELD_MAP = {
  date: 'date', client: 'client', styleNo: 'style_no', packageSpec: 'package_spec', piNo: 'pi_no',
  lineId: 'line_id', lineIds: 'line_ids', blNo: 'bl_no', totalTons: 'total_tons', containers: 'containers',
  packagesPerContainer: 'packages_per_container', port: 'port', contactPerson: 'contact_person',
  tradeType: 'trade_type', requirements: 'requirements', status: 'status', isLargeOrder: 'is_large_order',
  largeOrderAck: 'large_order_ack', loadingTimeSlot: 'loading_time_slot', expectedShipDate: 'expected_ship_date',
  workshopCommStatus: 'workshop_comm_status', workshopNote: 'workshop_note', prepDaysRequired: 'prep_days_required',
  warehouseAllocation: 'warehouse_allocation'
};
const BOOL_FIELDS = ['isLargeOrder', 'largeOrderAck'];
const JSON_FIELDS = ['warehouseAllocation'];
const now = () => new Date().toISOString();

// 解析产线ID
const parseLineIds = (order) => {
  if (order.lineIds) return order.lineIds.split(/[\/,]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  return order.lineId ? [order.lineId] : [];
};

// 计算满足率
const calcFulfillment = (order, query) => {
  const lineIds = parseLineIds(order);
  const styleNo = order.styleNo || order.style_no;
  const tradeType = order.tradeType || order.trade_type;
  const totalTons = order.totalTons || order.total_tons || 0;
  const alloc = order.warehouseAllocation || (order.warehouse_allocation ? JSON.parse(order.warehouse_allocation) : null);
  
  const getStock = (whType) => {
    let sql = 'SELECT COALESCE(SUM(current_stock - locked_for_today), 0) as available FROM inventory WHERE style_no = ? AND warehouse_type = ?';
    const params = [styleNo, whType];
    if (lineIds.length) {
      sql += ` AND line_id IN (${lineIds.map(() => '?').join(',')})`;
      params.push(...lineIds);
    }
    return Math.max(0, query(sql, params)[0]?.available || 0);
  };
  
  let available = 0;
  if (alloc) {
    available = Math.min(alloc.general, getStock('general')) + Math.min(alloc.bonded, getStock('bonded'));
  } else {
    available = getStock(tradeType === 'Bonded' ? 'bonded' : 'general');
  }
  return totalTons > 0 ? (available / totalTons) * 100 : 100;
};

// 转换值为数据库存储格式
const toDbValue = (key, value) => {
  if (BOOL_FIELDS.includes(key)) return value ? 1 : 0;
  if (JSON_FIELDS.includes(key)) return value ? JSON.stringify(value) : null;
  return value;
};

// 订单字段列表（用于SQL构建）
const ORDER_FIELDS = Object.keys(FIELD_MAP);
const DB_COLUMNS = ORDER_FIELDS.map(k => FIELD_MAP[k]);

export const setupOrderRoutes = (queryWithParams, query, run, runNoSave, withTx, asyncHandler) => {
  // 查询所有订单
  const listOrders = () => {
    const fields = DB_COLUMNS.join(', ').replace(/style_no/g, 'style_no as styleNo').replace(/package_spec/g, 'package_spec as packageSpec').replace(/pi_no/g, 'pi_no as piNo').replace(/line_id/g, 'line_id as lineId').replace(/line_ids/g, 'line_ids as lineIds').replace(/bl_no/g, 'bl_no as blNo').replace(/total_tons/g, 'total_tons as totalTons').replace(/packages_per_container/g, 'packages_per_container as packagesPerContainer').replace(/contact_person/g, 'contact_person as contactPerson').replace(/trade_type/g, 'trade_type as tradeType').replace(/is_large_order/g, 'is_large_order as isLargeOrder').replace(/large_order_ack/g, 'large_order_ack as largeOrderAck').replace(/loading_time_slot/g, 'loading_time_slot as loadingTimeSlot').replace(/expected_ship_date/g, 'expected_ship_date as expectedShipDate').replace(/workshop_comm_status/g, 'workshop_comm_status as workshopCommStatus').replace(/workshop_note/g, 'workshop_note as workshopNote').replace(/prep_days_required/g, 'prep_days_required as prepDaysRequired').replace(/warehouse_allocation/g, 'warehouse_allocation as warehouseAllocation');
    return query(`SELECT id, date, client, ${fields} FROM orders ORDER BY date DESC`).map(r => ({ ...r, isLargeOrder: !!r.isLargeOrder, largeOrderAck: !!r.largeOrderAck, lineIds: r.lineIds != null ? String(r.lineIds) : null, warehouseAllocation: r.warehouseAllocation ? JSON.parse(r.warehouseAllocation) : null }));
  };

  router.get('/', asyncHandler((_, res) => res.json(listOrders())));

  // 创建订单
  router.post('/', asyncHandler((req, res) => {
    const o = req.body;
    const id = o.id || Date.now().toString(36);
    const values = [id, o.date, o.client, o.styleNo, o.packageSpec || null, o.piNo, o.lineId || null, o.lineIds || null, o.blNo, o.totalTons, o.containers || 1, o.packagesPerContainer || 30, o.port, o.contactPerson, o.tradeType, o.requirements, o.status || 'Pending', o.isLargeOrder ? 1 : 0, o.largeOrderAck ? 1 : 0, o.loadingTimeSlot || 'Flexible', o.expectedShipDate || null, o.workshopCommStatus || 'NotStarted', o.workshopNote || null, o.prepDaysRequired || 0, o.warehouseAllocation ? JSON.stringify(o.warehouseAllocation) : null];
    run(`INSERT INTO orders (${DB_COLUMNS.join(', ')}) VALUES (${DB_COLUMNS.map(() => '?').join(', ')})`, values);
    res.json({ success: true, id });
  }));

  // 更新订单
  router.put('/:id', asyncHandler((req, res) => {
    const o = req.body;
    const values = [o.date, o.client, o.styleNo, o.packageSpec, o.piNo, o.lineId, o.lineIds, o.blNo, o.totalTons, o.containers, o.packagesPerContainer, o.port, o.contactPerson, o.tradeType, o.requirements, o.status, o.isLargeOrder ? 1 : 0, o.largeOrderAck ? 1 : 0, o.loadingTimeSlot, o.expectedShipDate, o.workshopCommStatus, o.workshopNote, o.prepDaysRequired, o.warehouseAllocation ? JSON.stringify(o.warehouseAllocation) : null, req.params.id];
    run(`UPDATE orders SET ${DB_COLUMNS.map(c => `${c}=?`).join(', ')} WHERE id=?`, values);
    res.json({ success: true });
  }));

  // 部分更新
  router.patch('/:id', asyncHandler((req, res) => {
    const updates = req.body;
    
    // 状态切换时验证库存
    if (['ReadyToShip', 'Shipped'].includes(updates.status)) {
      const order = queryWithParams('SELECT * FROM orders WHERE id = ?', [req.params.id])[0];
      if (!order) return res.status(404).json({ error: '订单不存在' });
      if (!['ReadyToShip', 'Shipped'].includes(order.status)) {
        const pct = calcFulfillment(order, queryWithParams);
        if (pct < 100) return res.status(400).json({ error: `库存不足，当前满足率 ${pct.toFixed(1)}%，需要100%才能切换状态` });
      }
    }
    
    const validUpdates = Object.entries(updates)
      .filter(([k]) => FIELD_MAP[k])
      .map(([k, v]) => ({ field: FIELD_MAP[k], value: toDbValue(k, v) }));
    
    if (!validUpdates.length) return res.json({ success: true });
    withTx(() => validUpdates.forEach(({ field, value }) => runNoSave(`UPDATE orders SET ${field} = ? WHERE id = ?`, [value, req.params.id])));
    res.json({ success: true });
  }));

  // 删除订单（回滚库存）
  router.delete('/:id', asyncHandler((req, res) => {
    const order = queryWithParams('SELECT * FROM orders WHERE id = ?', [req.params.id])[0];
    if (!order) return res.status(404).json({ error: '订单不存在' });
    
    if (order.status === 'Shipped') {
      const txs = queryWithParams('SELECT * FROM inventory_transactions WHERE order_id = ? AND type = ?', [req.params.id, 'OUT']);
      if (txs.length) {
        withTx(() => {
          txs.forEach(tx => {
            const gradeField = tx.grade === 'B' ? 'grade_b' : 'grade_a';
            runNoSave(`UPDATE inventory SET current_stock = current_stock + ?, ${gradeField} = ${gradeField} + ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?`, [tx.quantity, tx.quantity, now(), tx.style_no, tx.warehouse_type || 'general', tx.package_spec || '820kg']);
            runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [tx.style_no, tx.warehouse_type || 'general', tx.package_spec || '820kg', 'IN', tx.grade || 'A', tx.quantity, 0, '订单删除回滚', `订单 ${order.pi_no || order.id} 删除，库存回滚`, req.params.id]);
          });
          runNoSave('DELETE FROM orders WHERE id = ?', [req.params.id]);
        });
        return res.json({ success: true, rolledBack: txs.length, message: `已回滚 ${txs.length} 条库存记录` });
      }
    }
    run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  }));

  return router;
};

export default setupOrderRoutes;
