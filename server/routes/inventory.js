import { Router } from 'express';

const router = Router();

export const setupInventoryRoutes = (queryWithParams, query, run, runNoSave, withTransaction, asyncHandler) => {
    // 库存列表
    router.get('/', asyncHandler((req, res) => {
        const { lineId } = req.query;
        let sql = 'SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, grade_a as gradeA, grade_b as gradeB, stock_t_minus_1 as stockTMinus1, locked_for_today as lockedForToday, safety_stock as safetyStock, last_updated as lastUpdated, line_id as lineId, line_name as lineName FROM inventory';
        const params = [];
        if (lineId) { sql += ' WHERE line_id = ?'; params.push(parseInt(lineId)); }
        sql += ' ORDER BY style_no, line_id';
        const rows = params.length > 0 ? queryWithParams(sql, params) : query(sql);
        res.json(rows.map(r => ({ ...r, warehouseType: r.warehouseType || 'general', packageSpec: r.packageSpec || '820kg', gradeA: r.gradeA || 0, gradeB: r.gradeB || 0, safetyStock: r.safetyStock || 0 })));
    }));

    // 库存预警查询
    router.get('/alerts', asyncHandler((req, res) => {
        const rows = query('SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, safety_stock as safetyStock FROM inventory WHERE safety_stock > 0 AND current_stock < safety_stock');
        res.json(rows.map(r => ({ ...r, shortage: r.safetyStock - r.currentStock })));
    }));

    // 设置安全库存
    router.put('/:styleNo/safety-stock', asyncHandler((req, res) => {
        const { warehouseType, packageSpec, safetyStock } = req.body;
        const wt = warehouseType || 'general';
        const ps = packageSpec || '820kg';
        run('UPDATE inventory SET safety_stock = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [safetyStock || 0, new Date().toISOString(), req.params.styleNo, wt, ps]);
        res.json({ success: true });
    }));

    // 更新库存
    router.put('/:styleNo', asyncHandler((req, res) => {
        const { warehouseType, packageSpec, currentStock, gradeA, gradeB, stockTMinus1, lockedForToday, reason, operator } = req.body;
        const wt = warehouseType || 'general';
        const ps = packageSpec || '820kg';
        const total = (gradeA || 0) + (gradeB || 0);
        const existing = queryWithParams('SELECT grade_a, grade_b FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [req.params.styleNo, wt, ps])[0];
        withTransaction(() => {
            runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, stock_t_minus_1 = ?, locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [currentStock || total, gradeA || 0, gradeB || 0, stockTMinus1, lockedForToday, new Date().toISOString(), req.params.styleNo, wt, ps]);
            if (existing) {
                runNoSave('INSERT INTO inventory_audit_logs (style_no, warehouse_type, package_spec, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.styleNo, wt, ps, 'adjust', existing.grade_a || 0, existing.grade_b || 0, gradeA || 0, gradeB || 0, reason || '手动调整', operator || 'system']);
            }
        });
        res.json({ success: true });
    }));

    // 库存锁定
    router.post('/:styleNo/lock', asyncHandler((req, res) => {
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

    // 库存解锁
    router.post('/:styleNo/unlock', asyncHandler((req, res) => {
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

    // 入库
    router.post('/in', asyncHandler((req, res) => {
        const { styleNo, warehouseType, packageSpec, quantity, grade, source, note, orderId, lineId, lineName } = req.body;
        if (!styleNo || !quantity) return res.status(400).json({ error: '款号和数量必填' });
        const wt = warehouseType || 'general';
        const ps = packageSpec || '820kg';
        const g = grade || 'A';
        const lid = lineId || null;
        const lname = lineName || null;
        const existing = lid
            ? queryWithParams('SELECT current_stock as currentStock, grade_a as gradeA, grade_b as gradeB FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id = ?', [styleNo, wt, ps, lid])[0]
            : queryWithParams('SELECT current_stock as currentStock, grade_a as gradeA, grade_b as gradeB FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id IS NULL', [styleNo, wt, ps])[0];
        const newGradeA = (existing?.gradeA || 0) + (g === 'A' ? quantity : 0);
        const newGradeB = (existing?.gradeB || 0) + (g === 'B' ? quantity : 0);
        const newBalance = newGradeA + newGradeB;
        withTransaction(() => {
            if (existing) {
                if (lid) {
                    runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id = ?', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps, lid]);
                } else {
                    runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id IS NULL', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps]);
                }
            } else {
                runNoSave('INSERT INTO inventory (style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, last_updated, line_id, line_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, newBalance, newGradeA, newGradeB, new Date().toISOString(), lid, lname]);
            }
            runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, 'IN', g, quantity, newBalance, source || (lid ? `产线${lid}入库` : null), note || null, orderId || null]);
        });
        res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB, lineId: lid });
    }));

    // 批量入库
    router.post('/batch-in', asyncHandler((req, res) => {
        const { items } = req.body;
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

    // 出库
    router.post('/out', asyncHandler((req, res) => {
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
        const newLocked = Math.max(0, (existing?.locked || 0) - quantity);
        withTransaction(() => {
            runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, locked_for_today = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?', [newBalance, newGradeA, newGradeB, newLocked, new Date().toISOString(), styleNo, wt, ps]);
            runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, 'OUT', g, quantity, newBalance, source || null, note || null, orderId || null]);
        });
        res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
    }));

    // 批量出库
    router.post('/batch-out', asyncHandler((req, res) => {
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

    // 盘点调整
    router.post('/adjust', asyncHandler((req, res) => {
        const { styleNo, warehouseType, packageSpec, gradeA, gradeB, reason, operator, lineId, lineName } = req.body;
        if (!styleNo) return res.status(400).json({ error: '款号必填' });
        const wt = warehouseType || 'general';
        const ps = packageSpec || '820kg';
        const lid = lineId || null;
        const lname = lineName || null;
        const existing = lid
            ? queryWithParams('SELECT grade_a, grade_b, line_id, line_name FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id = ?', [styleNo, wt, ps, lid])[0]
            : queryWithParams('SELECT grade_a, grade_b, line_id, line_name FROM inventory WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id IS NULL', [styleNo, wt, ps])[0];
        if (!existing) return res.status(404).json({ error: '库存记录不存在' });
        const newGradeA = gradeA !== undefined ? gradeA : existing.grade_a;
        const newGradeB = gradeB !== undefined ? gradeB : existing.grade_b;
        const newBalance = newGradeA + newGradeB;
        const recordLineId = existing.line_id || lid;
        const recordLineName = existing.line_name || lname;
        withTransaction(() => {
            if (lid) {
                runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id = ?', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps, lid]);
            } else {
                runNoSave('UPDATE inventory SET current_stock = ?, grade_a = ?, grade_b = ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ? AND line_id IS NULL', [newBalance, newGradeA, newGradeB, new Date().toISOString(), styleNo, wt, ps]);
            }
            runNoSave('INSERT INTO inventory_audit_logs (style_no, warehouse_type, package_spec, line_id, line_name, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, recordLineId, recordLineName, 'adjust', existing.grade_a, existing.grade_b, newGradeA, newGradeB, reason || '盘点调整', operator || 'system']);
            const diffA = newGradeA - existing.grade_a;
            const diffB = newGradeB - existing.grade_b;
            if (diffA !== 0) runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, diffA > 0 ? 'ADJUST_IN' : 'ADJUST_OUT', 'A', Math.abs(diffA), newBalance, '盘点调整', reason || null]);
            if (diffB !== 0) runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [styleNo, wt, ps, diffB > 0 ? 'ADJUST_IN' : 'ADJUST_OUT', 'B', Math.abs(diffB), newBalance, '盘点调整', reason || null]);
        });
        res.json({ success: true, balance: newBalance, gradeA: newGradeA, gradeB: newGradeB });
    }));

    // 库存流水（支持分页）
    router.get('/transactions', asyncHandler((req, res) => {
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
    router.get('/audit-logs', asyncHandler((req, res) => {
        const { styleNo, warehouseType, packageSpec, action, lineId, page = 1, pageSize = 50 } = req.query;
        const conditions = [];
        const params = [];
        if (styleNo) { conditions.push('style_no = ?'); params.push(styleNo); }
        if (warehouseType) { conditions.push('warehouse_type = ?'); params.push(warehouseType); }
        if (packageSpec) { conditions.push('package_spec = ?'); params.push(packageSpec); }
        if (action) { conditions.push('action = ?'); params.push(action); }
        if (lineId) { conditions.push('line_id = ?'); params.push(parseInt(lineId)); }
        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        const countSql = `SELECT COUNT(*) as total FROM inventory_audit_logs${whereClause}`;
        const total = (params.length > 0 ? queryWithParams(countSql, params) : query(countSql))[0]?.total || 0;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const dataSql = `SELECT id, style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, line_id as lineId, line_name as lineName, action, before_grade_a as beforeGradeA, before_grade_b as beforeGradeB, after_grade_a as afterGradeA, after_grade_b as afterGradeB, reason, operator, created_at as createdAt FROM inventory_audit_logs${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const rows = queryWithParams(dataSql, [...params, parseInt(pageSize), offset]);
        res.json({ data: rows, total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) });
    }));

    // 库存报表导出
    router.get('/export', asyncHandler((req, res) => {
        const rows = query('SELECT style_no as styleNo, warehouse_type as warehouseType, package_spec as packageSpec, current_stock as currentStock, grade_a as gradeA, grade_b as gradeB, locked_for_today as lockedForToday, safety_stock as safetyStock, last_updated as lastUpdated FROM inventory ORDER BY style_no');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=inventory_${new Date().toISOString().split('T')[0]}.json`);
        res.json({ exportedAt: new Date().toISOString(), count: rows.length, data: rows });
    }));

    return router;
};

export default setupInventoryRoutes;
