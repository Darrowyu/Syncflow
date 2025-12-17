import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { initDatabase, getDb, saveDatabase } from './db/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载项目根目录的.env.local配置文件
config({ path: join(__dirname, '..', '.env.local') });

const app = express();
app.use(cors());
app.use(express.json());

// 生产环境托管前端静态文件
const distPath = join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// 简易请求限流：每IP每秒最多20次请求
const rateLimit = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 1000;
  const maxRequests = 20;
  const requests = rateLimit.get(ip) || [];
  const recent = requests.filter(t => now - t < windowMs);
  if (recent.length >= maxRequests) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  recent.push(now);
  rateLimit.set(ip, recent);
  next();
});

await initDatabase();

// 参数化查询，防止SQL注入
const queryWithParams = (sql, params = []) => {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
};
const query = (sql) => queryWithParams(sql, []);
const run = (sql, params = []) => { const db = getDb(); db.run(sql, params); saveDatabase(); };
const runNoSave = (sql, params = []) => { const db = getDb(); db.run(sql, params); }; // 事务内部使用，不自动保存

// 事务处理：确保多表操作的数据一致性
const withTransaction = (operations) => {
  const db = getDb();
  try {
    db.run('BEGIN TRANSACTION');
    const result = operations();
    db.run('COMMIT');
    saveDatabase();
    return result;
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
};

// 全局错误处理中间件
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ========== 库存 API ==========
app.get('/api/inventory', asyncHandler((req, res) => {
  const rows = query('SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, grade_a as gradeA, grade_b as gradeB, stock_t_minus_1 as stockTMinus1, locked_for_today as lockedForToday, safety_stock as safetyStock, last_updated as lastUpdated FROM inventory');
  res.json(rows.map(r => ({ ...r, warehouseType: r.warehouseType || 'general', packageSpec: r.packageSpec || '820kg', gradeA: r.gradeA || 0, gradeB: r.gradeB || 0, safetyStock: r.safetyStock || 0 })));
}));

// 库存预警查询
app.get('/api/inventory/alerts', asyncHandler((req, res) => {
  const rows = query('SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, safety_stock as safetyStock FROM inventory WHERE safety_stock > 0 AND current_stock < safety_stock');
  res.json(rows.map(r => ({ ...r, shortage: r.safetyStock - r.currentStock })));
}));

// 设置安全库存
app.put('/api/inventory/:styleNo/safety-stock', asyncHandler((req, res) => {
  const { warehouseType, packageSpec, safetyStock } = req.body;
  const wt = warehouseType || 'general';
  const ps = packageSpec || '820kg';
  run('UPDATE inventory SET safety_stock = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [safetyStock || 0, new Date().toISOString(), req.params.styleNo, wt, ps]);
  res.json({ success: true });
}));

app.put('/api/inventory/:styleNo', asyncHandler((req, res) => {
  const { warehouseType, packageSpec, currentStock, gradeA, gradeB, stockTMinus1, lockedForToday, reason, operator } = req.body;
  const wt = warehouseType || 'general';
  const ps = packageSpec || '820kg';
  const total = (gradeA || 0) + (gradeB || 0);
  const existing = queryWithParams('SELECT grade_a, grade_b FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [req.params.styleNo, wt, ps])[0];
  withTransaction(() => {
    runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, stock_t_minus_1 = ?, locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [currentStock || total, gradeA || 0, gradeB || 0, stockTMinus1, lockedForToday, new Date().toISOString(), req.params.styleNo, wt, ps]);
    if (existing) { // 记录审计日志
      runNoSave('INSERT INTO inventory_audit_logs (style_no, warehouse_type, package_spec, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.styleNo, wt, ps, 'adjust', existing.grade_a || 0, existing.grade_b || 0, gradeA || 0, gradeB || 0, reason || '手动调整', operator || 'system']);
    }
  });
  res.json({ success: true });
}));

// 库存锁定/解锁
app.post('/api/inventory/:styleNo/lock', asyncHandler((req, res) => {
  const { warehouseType, packageSpec, quantity, reason, operator } = req.body;
  const wt = warehouseType || 'general';
  const ps = packageSpec || '820kg';
  const existing = queryWithParams('SELECT current_stock, locked_for_today, grade_a, grade_b FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [req.params.styleNo, wt, ps])[0];
  if (!existing) return res.status(404).json({ error: '库存记录不存在' });
  const available = existing.current_stock - existing.locked_for_today;
  if (quantity > available) return res.status(400).json({ error: `可用库存不足，当前可用: ${available}t` });
  const newLocked = (existing.locked_for_today || 0) + quantity;
  withTransaction(() => {
    runNoSave('UPDATE inventory SET locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newLocked, new Date().toISOString(), req.params.styleNo, wt, ps]);
    runNoSave('INSERT INTO inventory_audit_logs (style_no, warehouse_type, package_spec, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.styleNo, wt, ps, 'lock', existing.grade_a, existing.grade_b, existing.grade_a, existing.grade_b, reason || `锁定 ${quantity}t`, operator || 'system']);
  });
  res.json({ success: true, locked: newLocked });
}));

app.post('/api/inventory/:styleNo/unlock', asyncHandler((req, res) => {
  const { warehouseType, packageSpec, quantity, reason, operator } = req.body;
  const wt = warehouseType || 'general';
  const ps = packageSpec || '820kg';
  const existing = queryWithParams('SELECT locked_for_today, grade_a, grade_b FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [req.params.styleNo, wt, ps])[0];
  if (!existing) return res.status(404).json({ error: '库存记录不存在' });
  const newLocked = Math.max(0, (existing.locked_for_today || 0) - quantity);
  withTransaction(() => {
    runNoSave('UPDATE inventory SET locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newLocked, new Date().toISOString(), req.params.styleNo, wt, ps]);
    runNoSave('INSERT INTO inventory_audit_logs (style_no, warehouse_type, package_spec, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.styleNo, wt, ps, 'unlock', existing.grade_a, existing.grade_b, existing.grade_a, existing.grade_b, reason || `解锁 ${quantity}t`, operator || 'system']);
  });
  res.json({ success: true, locked: newLocked });
}));

// 入库（事务处理）
app.post('/api/inventory/in', asyncHandler((req, res) => {
  const { styleNo, warehouseType, packageSpec, quantity, grade, source, note, orderId } = req.body;
  if (!styleNo || !quantity) return res.status(400).json({ error: '款号和数量必填' });
  const wt = warehouseType || 'general';
  const ps = packageSpec || '820kg';
  const g = grade || 'A';
  const existing = queryWithParams('SELECT current_stock as currentStock, grade_a as gradeA, grade_b as gradeB FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [styleNo, wt, ps])[0];
  const newGradeA = (existing?.gradeA || 0) + (g === 'A' ? quantity : 0);
  const newGradeB = (existing?.gradeB || 0) + (g === 'B' ? quantity : 0);
  const newBalance = newGradeA + newGradeB;
  withTransaction(() => {
    if (existing) {
      runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps]);
    } else {
      runNoSave('INSERT INTO inventory (style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, newBalance, newGradeA, newGradeB, new Date().toISOString()]);
    }
    runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, 'IN', g, quantity, newBalance, source || null, note || null, orderId || null]);
  });
  res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
}));

// 批量入库
app.post('/api/inventory/batch-in', asyncHandler((req, res) => {
  const { items } = req.body; // items: Array<{styleNo, warehouseType?, packageSpec?, quantity, grade?, source?, note?}>
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: '请提供入库项目列表' });
  const results = [];
  withTransaction(() => {
    for (const item of items) {
      const { styleNo, warehouseType, packageSpec, quantity, grade, source, note } = item;
      if (!styleNo || !quantity) continue;
      const wt = warehouseType || 'general';
      const ps = packageSpec || '820kg';
      const g = grade || 'A';
      const existing = queryWithParams('SELECT current_stock, grade_a, grade_b FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [styleNo, wt, ps])[0];
      const newGradeA = (existing?.grade_a || 0) + (g === 'A' ? quantity : 0);
      const newGradeB = (existing?.grade_b || 0) + (g === 'B' ? quantity : 0);
      const newBalance = newGradeA + newGradeB;
      if (existing) {
        runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps]);
      } else {
        runNoSave('INSERT INTO inventory (style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, newBalance, newGradeA, newGradeB, new Date().toISOString()]);
      }
      runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, 'IN', g, quantity, newBalance, source || '批量入库', note || null]);
      results.push({ styleNo, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
    }
  });
  res.json({ success: true, count: results.length, results });
}));

// 出库（事务处理）
app.post('/api/inventory/out', asyncHandler((req, res) => {
  const { styleNo, warehouseType, packageSpec, quantity, grade, source, note, orderId } = req.body;
  if (!styleNo || !quantity) return res.status(400).json({ error: '款号和数量必填' });
  const wt = warehouseType || 'general';
  const ps = packageSpec || '820kg';
  const g = grade || 'A';
  const existing = queryWithParams('SELECT current_stock as currentStock, grade_a as gradeA, grade_b as gradeB, locked_for_today as locked FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [styleNo, wt, ps])[0];
  const gradeStock = g === 'A' ? (existing?.gradeA || 0) : (existing?.gradeB || 0);
  if (!existing || gradeStock < quantity) return res.status(400).json({ error: `${g === 'A' ? '优等品' : '一等品'}库存不足` });
  const newGradeA = (existing?.gradeA || 0) - (g === 'A' ? quantity : 0);
  const newGradeB = (existing?.gradeB || 0) - (g === 'B' ? quantity : 0);
  const newBalance = newGradeA + newGradeB;
  const newLocked = Math.max(0, (existing?.locked || 0) - quantity); // 出库时自动释放锁定
  withTransaction(() => {
    runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, newLocked, new Date().toISOString(), styleNo, wt, ps]);
    runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, 'OUT', g, quantity, newBalance, source || null, note || null, orderId || null]);
  });
  res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
}));

// 批量出库
app.post('/api/inventory/batch-out', asyncHandler((req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: '请提供出库项目列表' });
  const results = [];
  const errors = [];
  withTransaction(() => {
    for (const item of items) {
      const { styleNo, warehouseType, packageSpec, quantity, grade, source, note } = item;
      if (!styleNo || !quantity) continue;
      const wt = warehouseType || 'general';
      const ps = packageSpec || '820kg';
      const g = grade || 'A';
      const existing = queryWithParams('SELECT current_stock, grade_a, grade_b FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [styleNo, wt, ps])[0];
      const gradeStock = g === 'A' ? (existing?.grade_a || 0) : (existing?.grade_b || 0);
      if (!existing || gradeStock < quantity) { errors.push({ styleNo, error: `${g === 'A' ? '优等品' : '一等品'}库存不足` }); continue; }
      const newGradeA = (existing?.grade_a || 0) - (g === 'A' ? quantity : 0);
      const newGradeB = (existing?.grade_b || 0) - (g === 'B' ? quantity : 0);
      const newBalance = newGradeA + newGradeB;
      runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps]);
      runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, 'OUT', g, quantity, newBalance, source || '批量出库', note || null]);
      results.push({ styleNo, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
    }
  });
  res.json({ success: true, count: results.length, results, errors });
}));

// 单次盘点调整（优化：合并A/B等级调整为单次API调用）
app.post('/api/inventory/adjust', asyncHandler((req, res) => {
  const { styleNo, warehouseType, packageSpec, gradeA, gradeB, reason, operator } = req.body;
  if (!styleNo) return res.status(400).json({ error: '款号必填' });
  const wt = warehouseType || 'general';
  const ps = packageSpec || '820kg';
  const existing = queryWithParams('SELECT grade_a, grade_b FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [styleNo, wt, ps])[0];
  if (!existing) return res.status(404).json({ error: '库存记录不存在' });
  const newGradeA = gradeA !== undefined ? gradeA : existing.grade_a;
  const newGradeB = gradeB !== undefined ? gradeB : existing.grade_b;
  const newBalance = newGradeA + newGradeB;
  withTransaction(() => {
    runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps]);
    runNoSave('INSERT INTO inventory_audit_logs (style_no, warehouse_type, package_spec, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, 'adjust', existing.grade_a, existing.grade_b, newGradeA, newGradeB, reason || '盘点调整', operator || 'system']);
    // 记录流水（差异部分，使用ADJUST_IN/ADJUST_OUT区分盘点调整）
    const diffA = newGradeA - existing.grade_a;
    const diffB = newGradeB - existing.grade_b;
    if (diffA !== 0) runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, diffA > 0 ? 'ADJUST_IN' : 'ADJUST_OUT', 'A', Math.abs(diffA), newBalance, '盘点调整', reason || null]);
    if (diffB !== 0) runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, diffB > 0 ? 'ADJUST_IN' : 'ADJUST_OUT', 'B', Math.abs(diffB), newBalance, '盘点调整', reason || null]);
  });
  res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
}));

// 库存流水（支持分页）
app.get('/api/inventory/transactions', asyncHandler((req, res) => {
  const { styleNo, warehouseType, packageSpec, type, startDate, endDate, page = 1, pageSize = 50 } = req.query;
  const conditions = [];
  const params = [];
  if (styleNo) { conditions.push('style_no = ?'); params.push(styleNo); }
  if (warehouseType) { conditions.push('warehouse_type = ?'); params.push(warehouseType); }
  if (packageSpec) { conditions.push('package_spec = ?'); params.push(packageSpec); }
  if (type) { conditions.push('type = ?'); params.push(type); }
  if (startDate) { conditions.push('created_at >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('created_at <= ?'); params.push(endDate + 'T23:59:59'); }
  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  const countSql = `SELECT COUNT(*) as total FROM inventory_transactions${whereClause}`;
  const total = (params.length > 0 ? queryWithParams(countSql, params) : query(countSql))[0]?.total || 0;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const dataSql = `SELECT id, style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, type, grade, quantity, balance, source, note, order_id as orderId, created_at as createdAt FROM inventory_transactions${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const dataParams = [...params, parseInt(pageSize), offset];
  const rows = queryWithParams(dataSql, dataParams);
  res.json({ data: rows.map(r => ({ ...r, warehouseType: r.warehouseType || 'general', packageSpec: r.packageSpec || '820kg', grade: r.grade || 'A' })), total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) });
}));

// 审计日志查询
app.get('/api/inventory/audit-logs', asyncHandler((req, res) => {
  const { styleNo, warehouseType, packageSpec, action, page = 1, pageSize = 50 } = req.query;
  const conditions = [];
  const params = [];
  if (styleNo) { conditions.push('style_no = ?'); params.push(styleNo); }
  if (warehouseType) { conditions.push('warehouse_type = ?'); params.push(warehouseType); }
  if (packageSpec) { conditions.push('package_spec = ?'); params.push(packageSpec); }
  if (action) { conditions.push('action = ?'); params.push(action); }
  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  const countSql = `SELECT COUNT(*) as total FROM inventory_audit_logs${whereClause}`;
  const total = (params.length > 0 ? queryWithParams(countSql, params) : query(countSql))[0]?.total || 0;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const dataSql = `SELECT id, style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, action, before_grade_a as beforeGradeA, before_grade_b as beforeGradeB, after_grade_a as afterGradeA, after_grade_b as afterGradeB, reason, operator, created_at as createdAt FROM inventory_audit_logs${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const rows = queryWithParams(dataSql, [...params, parseInt(pageSize), offset]);
  res.json({ data: rows, total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) });
}));

// 库存报表导出
app.get('/api/inventory/export', asyncHandler((req, res) => {
  const rows = query('SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, grade_a as gradeA, grade_b as gradeB, locked_for_today as lockedForToday, safety_stock as safetyStock, last_updated as lastUpdated FROM inventory ORDER BY style_no');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=inventory_${new Date().toISOString().split('T')[0]}.json`);
  res.json({ exportedAt: new Date().toISOString(), count: rows.length, data: rows });
}));

// ========== 产线 API ==========
app.get('/api/lines', asyncHandler((req, res) => {
  const rows = query('SELECT id, name, status, current_style as currentStyle, daily_capacity as dailyCapacity, export_capacity as exportCapacity, note, style_changed_at as styleChangedAt, sub_lines as subLines FROM production_lines ORDER BY id');
  res.json(rows.map(r => ({ ...r, subLines: r.subLines ? JSON.parse(r.subLines) : [] })));
}));

app.post('/api/lines', asyncHandler((req, res) => {
  const { name, status, currentStyle, dailyCapacity, exportCapacity, note, subLines } = req.body;
  const maxId = query('SELECT MAX(id) as maxId FROM production_lines')[0]?.maxId || 0;
  const newId = maxId + 1;
  run('INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity, note, sub_lines) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [newId, name || `Line ${newId}`, status || 'Stopped', currentStyle || '-', dailyCapacity || 0, exportCapacity || 0, note || null, subLines ? JSON.stringify(subLines) : null]);
  res.json({ success: true, id: newId });
}));

app.put('/api/lines/:id', asyncHandler((req, res) => {
  const { name, status, currentStyle, dailyCapacity, exportCapacity, note, styleChangedAt, previousStyle, subLines, subLineChanges, changeTime } = req.body;
  const lineId = parseInt(req.params.id, 10);
  const now = changeTime || new Date().toISOString();
  if (previousStyle !== undefined && previousStyle !== currentStyle) {
    run('INSERT INTO style_change_logs (line_id, from_style, to_style, changed_at) VALUES (?, ?, ?, ?)', [lineId, previousStyle, currentStyle, now]);
  }
  if (subLineChanges && Array.isArray(subLineChanges)) {
    subLineChanges.forEach(change => {
      run('INSERT INTO style_change_logs (line_id, from_style, to_style, changed_at) VALUES (?, ?, ?, ?)',
        [lineId, `${change.subName}:${change.fromStyle}`, `${change.subName}:${change.toStyle}`, now]);
    });
  }
  run('UPDATE production_lines SET name = ?, status = ?, current_style = ?, daily_capacity = ?, export_capacity = ?, note = ?, style_changed_at = ?, sub_lines = ? WHERE id = ?',
    [name, status, currentStyle, dailyCapacity, exportCapacity, note || null, styleChangedAt || null, subLines ? JSON.stringify(subLines) : null, lineId]);
  res.json({ success: true });
}));

app.delete('/api/lines/:id', asyncHandler((req, res) => {
  run('DELETE FROM production_lines WHERE id = ?', [parseInt(req.params.id, 10)]);
  res.json({ success: true });
}));

// ========== 款号变更历史 API ==========
app.get('/api/style-logs', asyncHandler((req, res) => {
  const rows = query('SELECT id, line_id as lineId, from_style as fromStyle, to_style as toStyle, changed_at as changedAt FROM style_change_logs ORDER BY changed_at DESC');
  res.json(rows);
}));

app.get('/api/style-logs/:lineId', asyncHandler((req, res) => {
  const rows = queryWithParams('SELECT id, line_id as lineId, from_style as fromStyle, to_style as toStyle, changed_at as changedAt FROM style_change_logs WHERE line_id = ? ORDER BY changed_at DESC LIMIT 10', [parseInt(req.params.lineId, 10)]);
  res.json(rows);
}));

// ========== 订单 API ==========
app.get('/api/orders', asyncHandler((req, res) => {
  const rows = query('SELECT id, date, client, style_no as styleNo, pi_no as piNo, line_id as lineId, bl_no as blNo, total_tons as totalTons, containers, packages_per_container as packagesPerContainer, port, contact_person as contactPerson, trade_type as tradeType, requirements, status, is_large_order as isLargeOrder, large_order_ack as largeOrderAck, loading_time_slot as loadingTimeSlot, expected_ship_date as expectedShipDate, workshop_comm_status as workshopCommStatus, workshop_note as workshopNote, prep_days_required as prepDaysRequired FROM orders ORDER BY date DESC');
  res.json(rows.map(r => ({ ...r, isLargeOrder: !!r.isLargeOrder, largeOrderAck: !!r.largeOrderAck })));
}));

app.post('/api/orders', asyncHandler((req, res) => {
  const o = req.body;
  const id = o.id || Date.now().toString(36);
  run('INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, workshop_note, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, o.date, o.client, o.styleNo, o.piNo, o.lineId, o.blNo, o.totalTons, o.containers, o.packagesPerContainer, o.port, o.contactPerson, o.tradeType, o.requirements, o.status || 'Pending', o.isLargeOrder ? 1 : 0, o.largeOrderAck ? 1 : 0, o.loadingTimeSlot || 'Flexible', o.expectedShipDate, o.workshopCommStatus || 'NotStarted', o.workshopNote, o.prepDaysRequired || 0]);
  res.json({ success: true, id });
}));

app.put('/api/orders/:id', asyncHandler((req, res) => {
  const o = req.body;
  run('UPDATE orders SET date=?, client=?, style_no=?, pi_no=?, line_id=?, bl_no=?, total_tons=?, containers=?, packages_per_container=?, port=?, contact_person=?, trade_type=?, requirements=?, status=?, is_large_order=?, large_order_ack=?, loading_time_slot=?, expected_ship_date=?, workshop_comm_status=?, workshop_note=?, prep_days_required=? WHERE id=?',
    [o.date, o.client, o.styleNo, o.piNo, o.lineId, o.blNo, o.totalTons, o.containers, o.packagesPerContainer, o.port, o.contactPerson, o.tradeType, o.requirements, o.status, o.isLargeOrder ? 1 : 0, o.largeOrderAck ? 1 : 0, o.loadingTimeSlot, o.expectedShipDate, o.workshopCommStatus, o.workshopNote, o.prepDaysRequired, req.params.id]);
  res.json({ success: true });
}));

app.patch('/api/orders/:id', asyncHandler((req, res) => {
  const updates = req.body;
  const fieldMap = { date: 'date', client: 'client', styleNo: 'style_no', piNo: 'pi_no', lineId: 'line_id', blNo: 'bl_no', totalTons: 'total_tons', containers: 'containers', packagesPerContainer: 'packages_per_container', port: 'port', contactPerson: 'contact_person', tradeType: 'trade_type', requirements: 'requirements', status: 'status', isLargeOrder: 'is_large_order', largeOrderAck: 'large_order_ack', loadingTimeSlot: 'loading_time_slot', expectedShipDate: 'expected_ship_date', workshopCommStatus: 'workshop_comm_status', workshopNote: 'workshop_note', prepDaysRequired: 'prep_days_required' };
  const boolFields = ['isLargeOrder', 'largeOrderAck'];
  const validUpdates = []; // 收集有效更新
  for (const [k, v] of Object.entries(updates)) {
    if (!Object.prototype.hasOwnProperty.call(fieldMap, k)) continue; // 白名单验证+原型污染防护
    validUpdates.push({ field: fieldMap[k], value: boolFields.includes(k) ? (v ? 1 : 0) : v });
  }
  if (validUpdates.length === 0) return res.json({ success: true }); // 无有效更新直接返回
  withTransaction(() => { // 事务保护确保原子性
    for (const { field, value } of validUpdates) {
      runNoSave(`UPDATE orders SET ${field} = ? WHERE id = ?`, [value, req.params.id]);
    }
  });
  res.json({ success: true });
}));

app.delete('/api/orders/:id', asyncHandler((req, res) => {
  run('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ========== 款号 API ==========
app.get('/api/styles', asyncHandler((req, res) => {
  const rows = query('SELECT id, style_no as styleNo, name, category, unit_weight as unitWeight, note FROM styles ORDER BY style_no');
  res.json(rows);
}));

app.post('/api/styles', asyncHandler((req, res) => {
  const { styleNo, name, category, unitWeight, note } = req.body;
  if (!styleNo) return res.status(400).json({ error: '款号必填' });
  run('INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)', [styleNo, name, category, unitWeight || 0, note]);
  res.json({ success: true });
}));

app.put('/api/styles/:id', asyncHandler((req, res) => {
  const { styleNo, name, category, unitWeight, note } = req.body;
  run('UPDATE styles SET style_no = ?, name = ?, category = ?, unit_weight = ?, note = ? WHERE id = ?', [styleNo, name, category, unitWeight, note, parseInt(req.params.id, 10)]);
  res.json({ success: true });
}));

app.delete('/api/styles/:id', asyncHandler((req, res) => {
  run('DELETE FROM styles WHERE id = ?', [parseInt(req.params.id, 10)]);
  res.json({ success: true });
}));

// ========== 异常日志 API ==========
app.get('/api/incidents', asyncHandler((req, res) => {
  const rows = query('SELECT id, timestamp, style_no as styleNo, order_client as orderClient, reported_by as reportedBy, reason, note, resolved, resolved_at as resolvedAt FROM incidents ORDER BY timestamp DESC');
  res.json(rows.map(r => ({ ...r, resolved: !!r.resolved })));
}));

app.post('/api/incidents', asyncHandler((req, res) => {
  const i = req.body;
  if (!i.styleNo || !i.reportedBy || !i.reason) return res.status(400).json({ error: '款号、上报人、原因必填' });
  const id = i.id || Date.now().toString(36);
  run('INSERT INTO incidents (id, timestamp, style_no, order_client, reported_by, reason, note, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
    [id, i.timestamp || new Date().toISOString(), i.styleNo, i.orderClient, i.reportedBy, i.reason, i.note]);
  res.json({ success: true, id });
}));

app.patch('/api/incidents/:id', asyncHandler((req, res) => {
  const { resolved } = req.body;
  if (resolved !== undefined) {
    run('UPDATE incidents SET resolved = ?, resolved_at = ? WHERE id = ?', [resolved ? 1 : 0, resolved ? new Date().toISOString() : null, req.params.id]);
  }
  res.json({ success: true });
}));

app.delete('/api/incidents/:id', asyncHandler((req, res) => {
  run('DELETE FROM incidents WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ========== 数据备份与恢复 API ==========
app.get('/api/backup', asyncHandler((req, res) => {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    orders: query('SELECT * FROM orders'),
    inventory: query('SELECT * FROM inventory'),
    production_lines: query('SELECT * FROM production_lines'),
    styles: query('SELECT * FROM styles'),
    incidents: query('SELECT * FROM incidents'),
    inventory_transactions: query('SELECT * FROM inventory_transactions ORDER BY created_at DESC LIMIT 1000'),
    style_change_logs: query('SELECT * FROM style_change_logs ORDER BY changed_at DESC LIMIT 500'),
  };
  res.setHeader('Content-Disposition', `attachment; filename=syncflow_backup_${new Date().toISOString().split('T')[0]}.json`);
  res.json(data);
}));

app.post('/api/restore', asyncHandler((req, res) => {
  const confirmToken = req.headers['x-confirm-restore']; // 安全验证：需要确认令牌
  if (confirmToken !== 'CONFIRM_RESTORE') return res.status(403).json({ error: '危险操作：需要确认令牌', requiredHeader: 'X-Confirm-Restore: CONFIRM_RESTORE' });
  const data = req.body;
  if (!data.version || !data.orders) return res.status(400).json({ error: '无效的备份文件格式' });
  withTransaction(() => { // 事务保护确保恢复操作原子性
    const db = getDb();
    db.run('DELETE FROM orders');
    db.run('DELETE FROM inventory');
    db.run('DELETE FROM production_lines');
    db.run('DELETE FROM styles');
    db.run('DELETE FROM incidents');
    data.orders?.forEach(o => runNoSave('INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, workshop_note, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [o.id, o.date, o.client, o.style_no, o.pi_no, o.line_id, o.bl_no, o.total_tons, o.containers, o.packages_per_container, o.port, o.contact_person, o.trade_type, o.requirements, o.status, o.is_large_order, o.large_order_ack, o.loading_time_slot, o.expected_ship_date, o.workshop_comm_status, o.workshop_note, o.prep_days_required]));
    data.inventory?.forEach(i => runNoSave('INSERT INTO inventory (id, style_no, current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today) VALUES (?, ?, ?, ?, ?, ?, ?)', [i.id, i.style_no, i.current_stock, i.grade_a, i.grade_b, i.stock_t_minus_1, i.locked_for_today]));
    data.production_lines?.forEach(l => runNoSave('INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity, note, style_changed_at, sub_lines) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [l.id, l.name, l.status, l.current_style, l.daily_capacity, l.export_capacity, l.note, l.style_changed_at, l.sub_lines]));
    data.styles?.forEach(s => runNoSave('INSERT INTO styles (id, style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?, ?)', [s.id, s.style_no, s.name, s.category, s.unit_weight, s.note]));
    data.incidents?.forEach(i => runNoSave('INSERT INTO incidents (id, timestamp, style_no, order_client, reported_by, reason, note, resolved, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [i.id, i.timestamp, i.style_no, i.order_client, i.reported_by, i.reason, i.note, i.resolved, i.resolved_at]));
  });
  res.json({ success: true, message: `已恢复 ${data.orders?.length || 0} 条订单, ${data.inventory?.length || 0} 条库存` });
}));

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

// SPA路由：所有非API请求返回index.html
if (existsSync(distPath)) {
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

// ========== 每日自动备份功能 ==========
const BACKUP_DIR = join(__dirname, 'backups');
const BACKUP_HOUR = 3; // 每天凌晨3点备份
const BACKUP_KEEP_DAYS = 30; // 保留30天的备份

const performBackup = () => {
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      orders: query('SELECT * FROM orders'),
      inventory: query('SELECT * FROM inventory'),
      production_lines: query('SELECT * FROM production_lines'),
      styles: query('SELECT * FROM styles'),
      incidents: query('SELECT * FROM incidents'),
    };
    const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(join(BACKUP_DIR, filename), JSON.stringify(data, null, 2));
    console.log(`[Auto Backup] 备份成功: ${filename}`);
    cleanOldBackups(); // 清理旧备份
  } catch (e) { console.error('[Auto Backup] 备份失败:', e.message); }
};

const cleanOldBackups = () => { // 清理超过30天的备份
  try {
    const { readdirSync, statSync, unlinkSync } = require('fs');
    const files = readdirSync(BACKUP_DIR);
    const now = Date.now();
    files.forEach(file => {
      const filePath = join(BACKUP_DIR, file);
      const stat = statSync(filePath);
      if (now - stat.mtimeMs > BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000) {
        unlinkSync(filePath);
        console.log(`[Auto Backup] 删除旧备份: ${file}`);
      }
    });
  } catch (e) { }
};

// 计算下次备份时间
const scheduleNextBackup = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(BACKUP_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // 如果今天的备份时间已过，则明天备份
  const delay = next.getTime() - now.getTime();
  console.log(`[Auto Backup] 下次备份时间: ${next.toLocaleString()}`);
  setTimeout(() => {
    performBackup();
    setInterval(performBackup, 24 * 60 * 60 * 1000); // 之后每24小时备份一次
  }, delay);
};

const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  scheduleNextBackup(); // 启动自动备份调度
  // 启动时执行一次备份（如果今天还没备份）
  const todayBackup = join(BACKUP_DIR, `backup_${new Date().toISOString().split('T')[0]}.json`);
  if (!existsSync(todayBackup)) performBackup();
});

