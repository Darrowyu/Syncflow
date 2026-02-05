import { Router } from 'express';

const router = Router();
const DEFAULTS = { warehouseType: 'general', packageSpec: '820kg', grade: 'A' };
const now = () => new Date().toISOString();
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// 通用库存查询
const findInventory = (queryWithParams, styleNo, wt, ps, lineId) => {
  const sql = lineId
    ? 'SELECT * FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id = ?'
    : 'SELECT * FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id IS NULL';
  return queryWithParams(sql, [styleNo, wt, ps, ...(lineId ? [lineId] : [])])[0];
};

// 通用审计日志
const logAudit = (run, data) => run('INSERT INTO inventory_audit_logs (style_no, warehouse_type, package_spec, line_id, line_name, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
  [data.styleNo, data.wt, data.ps, data.lineId, data.lineName, data.action, data.beforeA, data.beforeB, data.afterA, data.afterB, data.reason, data.operator || 'system']);

// 通用交易记录
const logTx = (run, data) => run('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  [data.styleNo, data.wt, data.ps, data.type, data.grade, round(data.qty), data.balance, data.source, data.note || null, data.orderId || null]);

// 构建分页查询
const paginate = (query, queryWithParams, table, fields, req) => {
  const conditions = [], params = [];
  ['styleNo', 'warehouseType', 'packageSpec'].forEach(f => { if (req.query[f]) { conditions.push(`${f.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = ?`); params.push(req.query[f]); }});
  if (req.query.type) { conditions.push('type = ?'); params.push(req.query.type); }
  if (req.query.startDate) { conditions.push('created_at >= ?'); params.push(req.query.startDate); }
  if (req.query.endDate) { conditions.push('created_at <= ?'); params.push(req.query.endDate + 'T23:59:59'); }
  if (req.query.action) { conditions.push('action = ?'); params.push(req.query.action); }
  if (req.query.lineId) { conditions.push('line_id = ?'); params.push(parseInt(req.query.lineId)); }
  
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.pageSize) || 50;
  const total = (params.length ? queryWithParams(`SELECT COUNT(*) as total FROM ${table}${where}`, params) : query(`SELECT COUNT(*) as total FROM ${table}${where}`))[0]?.total || 0;
  const rows = queryWithParams(`SELECT ${fields} FROM ${table}${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]);
  return { data: rows, total, page, pageSize: size, totalPages: Math.ceil(total / size) };
};

export const setupInventoryRoutes = (queryWithParams, query, run, runNoSave, withTx, asyncHandler) => {
  // 库存列表
  router.get('/', asyncHandler((req, res) => {
    const params = req.query.lineId ? [parseInt(req.query.lineId)] : [];
    const sql = 'SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, grade_a as gradeA, grade_b as gradeB, stock_t_minus_1 as stockTMinus1, locked_for_today as lockedForToday, safety_stock as safetyStock, last_updated as lastUpdated, line_id as lineId, line_name as lineName FROM inventory' + (params.length ? ' WHERE line_id = ?' : '') + ' ORDER BY style_no, line_id';
    const rows = params.length ? queryWithParams(sql, params) : query(sql);
    res.json(rows.map(r => ({ ...r, warehouseType: r.warehouseType || DEFAULTS.warehouseType, packageSpec: r.packageSpec || DEFAULTS.packageSpec, gradeA: r.gradeA || 0, gradeB: r.gradeB || 0, safetyStock: r.safetyStock || 0 })));
  }));

  // 库存预警
  router.get('/alerts', asyncHandler((_, res) => {
    const rows = query('SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, locked_for_today as lockedForToday, safety_stock as safetyStock FROM inventory WHERE safety_stock > 0 AND (current_stock - COALESCE(locked_for_today, 0)) < safety_stock');
    res.json(rows.map(r => ({ ...r, available: r.currentStock - (r.lockedForToday || 0), shortage: r.safetyStock - (r.currentStock - (r.lockedForToday || 0)) })));
  }));

  // 设置安全库存
  router.put('/:styleNo/safety-stock', asyncHandler((req, res) => {
    const { warehouseType, packageSpec, safetyStock } = req.body;
    run('UPDATE inventory SET safety_stock = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [safetyStock || 0, now(), req.params.styleNo, warehouseType || DEFAULTS.warehouseType, packageSpec || DEFAULTS.packageSpec]);
    res.json({ success: true });
  }));

  // 更新库存
  router.put('/:styleNo', asyncHandler((req, res) => {
    const { warehouseType, packageSpec, gradeA, gradeB, reason, operator } = req.body;
    const wt = warehouseType || DEFAULTS.warehouseType, ps = packageSpec || DEFAULTS.packageSpec;
    const existing = findInventory(queryWithParams, req.params.styleNo, wt, ps);
    withTx(() => {
      runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [(gradeA || 0) + (gradeB || 0), gradeA || 0, gradeB || 0, now(), req.params.styleNo, wt, ps]);
      if (existing) logAudit(runNoSave, { styleNo: req.params.styleNo, wt, ps, action: 'adjust', beforeA: existing.grade_a, beforeB: existing.grade_b, afterA: gradeA, afterB: gradeB, reason: reason || '手动调整', operator });
    });
    res.json({ success: true });
  }));

  // 库存锁定/解锁通用函数
  const modifyLock = (isLock) => asyncHandler((req, res) => {
    const { warehouseType, packageSpec, quantity, reason, operator } = req.body;
    const wt = warehouseType || DEFAULTS.warehouseType, ps = packageSpec || DEFAULTS.packageSpec;
    const existing = findInventory(queryWithParams, req.params.styleNo, wt, ps);
    if (!existing) return res.status(404).json({ error: '库存记录不存在' });
    
    const available = existing.current_stock - existing.locked_for_today;
    if (isLock && quantity > available) return res.status(400).json({ error: `可用库存不足，当前可用: ${available}t` });
    
    const newLocked = isLock ? (existing.locked_for_today || 0) + quantity : Math.max(0, (existing.locked_for_today || 0) - quantity);
    withTx(() => {
      runNoSave('UPDATE inventory SET locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newLocked, now(), req.params.styleNo, wt, ps]);
      logAudit(runNoSave, { styleNo: req.params.styleNo, wt, ps, action: isLock ? 'lock' : 'unlock', beforeA: existing.grade_a, beforeB: existing.grade_b, afterA: existing.grade_a, afterB: existing.grade_b, reason: reason || `${isLock ? '锁定' : '解锁'} ${quantity}t`, operator });
    });
    res.json({ success: true, locked: newLocked });
  });

  router.post('/:styleNo/lock', modifyLock(true));
  router.post('/:styleNo/unlock', modifyLock(false));

  // 入库操作（单条复用批量逻辑）
  router.post('/in', asyncHandler((req, res) => {
    const { styleNo, warehouseType, packageSpec, quantity, grade, source, note, orderId, lineId, lineName } = req.body;
    if (!styleNo || !quantity) return res.status(400).json({ error: '款号和数量必填' });
    const wt = warehouseType || DEFAULTS.warehouseType, ps = packageSpec || DEFAULTS.packageSpec, g = grade || DEFAULTS.grade;
    const existing = findInventory(queryWithParams, styleNo, wt, ps, lineId);
    const newGradeA = round((existing?.grade_a || 0) + (g === 'A' ? quantity : 0));
    const newGradeB = round((existing?.grade_b || 0) + (g === 'B' ? quantity : 0));
    const newBalance = round(newGradeA + newGradeB);
    
    withTx(() => {
      if (existing) {
        const where = lineId ? 'line_id = ?' : 'line_id IS NULL';
        runNoSave(`UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND ${where}`, [newBalance, newGradeA, newGradeB, now(), styleNo, wt, ps, ...(lineId ? [lineId] : [])]);
      } else {
        runNoSave('INSERT INTO inventory (style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, last_updated, line_id, line_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, newBalance, newGradeA, newGradeB, now(), lineId || null, lineName || null]);
      }
      logTx(runNoSave, { styleNo, wt, ps, type: 'IN', grade: g, qty: quantity, balance: newBalance, source: source || (lineId ? `产线${lineId}入库` : null), note, orderId });
    });
    res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB, lineId: lineId || null });
  }));

  // 批量入库
  router.post('/batch-in', asyncHandler((req, res) => {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: '请提供入库项目列表' });
    const results = [];
    withTx(() => {
      for (const item of items) {
        const { styleNo, warehouseType, packageSpec, quantity, grade, source, note, lineId, lineName } = item;
        if (!styleNo || !quantity) continue;
        const wt = warehouseType || DEFAULTS.warehouseType, ps = packageSpec || DEFAULTS.packageSpec, g = grade || DEFAULTS.grade;
        const existing = findInventory(queryWithParams, styleNo, wt, ps, lineId);
        const newGradeA = round((existing?.grade_a || 0) + (g === 'A' ? quantity : 0));
        const newGradeB = round((existing?.grade_b || 0) + (g === 'B' ? quantity : 0));
        const newBalance = round(newGradeA + newGradeB);
        if (existing) {
          const where = lineId ? 'line_id = ?' : 'line_id IS NULL';
          runNoSave(`UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND ${where}`, [newBalance, newGradeA, newGradeB, now(), styleNo, wt, ps, ...(lineId ? [lineId] : [])]);
        } else {
          runNoSave('INSERT INTO inventory (style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, last_updated, line_id, line_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, newBalance, newGradeA, newGradeB, now(), lineId || null, lineName || null]);
        }
        logTx(runNoSave, { styleNo, wt, ps, type: 'IN', grade: g, qty: quantity, balance: newBalance, source: source || (lineId ? `产线${lineId}批量入库` : '批量入库'), note });
        results.push({ styleNo, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB, lineId: lineId || null });
      }
    });
    res.json({ success: true, count: results.length, results });
  }));

  // 出库操作
  router.post('/out', asyncHandler((req, res) => {
    const { styleNo, warehouseType, packageSpec, quantity, grade, source, note, orderId } = req.body;
    if (!styleNo || !quantity) return res.status(400).json({ error: '款号和数量必填' });
    const wt = warehouseType || DEFAULTS.warehouseType, ps = packageSpec || DEFAULTS.packageSpec, g = grade || DEFAULTS.grade;
    const existing = findInventory(queryWithParams, styleNo, wt, ps);
    const gradeStock = g === 'A' ? (existing?.grade_a || 0) : (existing?.grade_b || 0);
    if (!existing || gradeStock < quantity) return res.status(400).json({ error: `${g === 'A' ? '优等品' : '一等品'}库存不足` });
    const newGradeA = round((existing.grade_a || 0) - (g === 'A' ? quantity : 0));
    const newGradeB = round((existing.grade_b || 0) - (g === 'B' ? quantity : 0));
    const newBalance = round(newGradeA + newGradeB);
    const newLocked = round(Math.max(0, (existing.locked_for_today || 0) - quantity));
    withTx(() => {
      runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, newLocked, now(), styleNo, wt, ps]);
      logTx(runNoSave, { styleNo, wt, ps, type: 'OUT', grade: g, qty: quantity, balance: newBalance, source, note, orderId });
    });
    res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
  }));

  // 批量出库
  router.post('/batch-out', asyncHandler((req, res) => {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: '请提供出库项目列表' });
    const results = [], errors = [];
    withTx(() => {
      for (const { styleNo, warehouseType, packageSpec, quantity, grade, source, note } of items) {
        if (!styleNo || !quantity) continue;
        const wt = warehouseType || DEFAULTS.warehouseType, ps = packageSpec || DEFAULTS.packageSpec, g = grade || DEFAULTS.grade;
        const existing = findInventory(queryWithParams, styleNo, wt, ps);
        const gradeStock = g === 'A' ? (existing?.grade_a || 0) : (existing?.grade_b || 0);
        if (!existing || gradeStock < quantity) { errors.push({ styleNo, error: `${g === 'A' ? '优等品' : '一等品'}库存不足` }); continue; }
        const newGradeA = round((existing.grade_a || 0) - (g === 'A' ? quantity : 0));
        const newGradeB = round((existing.grade_b || 0) - (g === 'B' ? quantity : 0));
        const newBalance = round(newGradeA + newGradeB);
        runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, now(), styleNo, wt, ps]);
        logTx(runNoSave, { styleNo, wt, ps, type: 'OUT', grade: g, qty: quantity, balance: newBalance, source: source || '批量出库', note });
        results.push({ styleNo, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
      }
    });
    res.json({ success: true, count: results.length, results, errors });
  }));

  // 盘点调整
  router.post('/adjust', asyncHandler((req, res) => {
    const { styleNo, warehouseType, packageSpec, gradeA, gradeB, reason, operator, lineId, lineName } = req.body;
    if (!styleNo) return res.status(400).json({ error: '款号必填' });
    const wt = warehouseType || DEFAULTS.warehouseType, ps = packageSpec || DEFAULTS.packageSpec;
    const existing = findInventory(queryWithParams, styleNo, wt, ps, lineId);
    if (!existing) return res.status(404).json({ error: '库存记录不存在' });
    const newGradeA = round(gradeA !== undefined ? gradeA : existing.grade_a);
    const newGradeB = round(gradeB !== undefined ? gradeB : existing.grade_b);
    const newBalance = round(newGradeA + newGradeB);
    withTx(() => {
      const where = lineId ? 'line_id = ?' : 'line_id IS NULL';
      runNoSave(`UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND ${where}`, [newBalance, newGradeA, newGradeB, now(), styleNo, wt, ps, ...(lineId ? [lineId] : [])]);
      logAudit(runNoSave, { styleNo, wt, ps, lineId: existing.line_id || lineId, lineName: existing.line_name || lineName, action: 'adjust', beforeA: existing.grade_a, beforeB: existing.grade_b, afterA: newGradeA, afterB: newGradeB, reason: reason || '盘点调整', operator });
      const diffA = round(newGradeA - existing.grade_a), diffB = round(newGradeB - existing.grade_b);
      if (diffA !== 0) logTx(runNoSave, { styleNo, wt, ps, type: diffA > 0 ? 'ADJUST_IN' : 'ADJUST_OUT', grade: 'A', qty: Math.abs(diffA), balance: newBalance, source: '盘点调整', note: reason });
      if (diffB !== 0) logTx(runNoSave, { styleNo, wt, ps, type: diffB > 0 ? 'ADJUST_IN' : 'ADJUST_OUT', grade: 'B', qty: Math.abs(diffB), balance: newBalance, source: '盘点调整', note: reason });
    });
    res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
  }));

  // 库存流水
  router.get('/transactions', asyncHandler((req, res) => {
    const fields = 'id, style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, type, grade, quantity, balance, source, note, order_id as orderId, created_at as createdAt';
    const result = paginate(query, queryWithParams, 'inventory_transactions', fields, req);
    result.data = result.data.map(r => ({ ...r, warehouseType: r.warehouseType || DEFAULTS.warehouseType, packageSpec: r.packageSpec || DEFAULTS.packageSpec, grade: r.grade || DEFAULTS.grade }));
    res.json(result);
  }));

  // 审计日志
  router.get('/audit-logs', asyncHandler((req, res) => {
    const fields = 'id, style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, line_id as lineId, line_name as lineName, action, before_grade_a as beforeGradeA, before_grade_b as beforeGradeB, after_grade_a as afterGradeA, after_grade_b as afterGradeB, reason, operator, created_at as createdAt';
    res.json(paginate(query, queryWithParams, 'inventory_audit_logs', fields, req));
  }));

  // 库存导出
  router.get('/export', asyncHandler((_, res) => {
    const rows = query('SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, grade_a as gradeA, grade_b as gradeB, locked_for_today as lockedForToday, safety_stock as safetyStock, last_updated as lastUpdated FROM inventory ORDER BY style_no');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=inventory_${now().split('T')[0]}.json`);
    res.json({ exportedAt: now(), count: rows.length, data: rows });
  }));

  return router;
};

export default setupInventoryRoutes;
