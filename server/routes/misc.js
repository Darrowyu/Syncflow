import { Router } from 'express';

const router = Router();

export const setupMiscRoutes = (queryWithParams, query, run, runNoSave, withTransaction, asyncHandler, getDb, existsSync, mkdirSync, writeFileSync, join, __dirname) => {
    // 款号API
    router.get('/styles', asyncHandler((req, res) => {
        const rows = query('SELECT id, style_no as styleNo, name, category, unit_weight as unitWeight, note FROM styles ORDER BY style_no');
        res.json(rows);
    }));

    router.post('/styles', asyncHandler((req, res) => {
        const { styleNo, name, category, unitWeight, note } = req.body;
        if (!styleNo) return res.status(400).json({ error: '款号必填' });
        run('INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)', [styleNo, name, category, unitWeight || 0, note]);
        res.json({ success: true });
    }));

    router.put('/styles/:id', asyncHandler((req, res) => {
        const { styleNo, name, category, unitWeight, note } = req.body;
        run('UPDATE styles SET style_no = ?, name = ?, category = ?, unit_weight = ?, note = ? WHERE id = ?', [styleNo, name, category, unitWeight, note, parseInt(req.params.id, 10)]);
        res.json({ success: true });
    }));

    router.delete('/styles/:id', asyncHandler((req, res) => {
        run('DELETE FROM styles WHERE id = ?', [parseInt(req.params.id, 10)]);
        res.json({ success: true });
    }));

    // 异常日志API
    router.get('/incidents', asyncHandler((req, res) => {
        const rows = query('SELECT id, timestamp, style_no as styleNo, order_client as orderClient, reported_by as reportedBy, reason, note, resolved, resolved_at as resolvedAt FROM incidents ORDER BY timestamp DESC');
        res.json(rows.map(r => ({ ...r, resolved: !!r.resolved })));
    }));

    router.post('/incidents', asyncHandler((req, res) => {
        const i = req.body;
        if (!i.styleNo || !i.reportedBy || !i.reason) return res.status(400).json({ error: '款号、上报人、原因必填' });
        const id = i.id || Date.now().toString(36);
        run('INSERT INTO incidents (id, timestamp, style_no, order_client, reported_by, reason, note, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
            [id, i.timestamp || new Date().toISOString(), i.styleNo, i.orderClient, i.reportedBy, i.reason, i.note]);
        res.json({ success: true, id });
    }));

    router.patch('/incidents/:id', asyncHandler((req, res) => {
        const { resolved } = req.body;
        if (resolved !== undefined) {
            run('UPDATE incidents SET resolved = ?, resolved_at = ? WHERE id = ?', [resolved ? 1 : 0, resolved ? new Date().toISOString() : null, req.params.id]);
        }
        res.json({ success: true });
    }));

    router.delete('/incidents/:id', asyncHandler((req, res) => {
        run('DELETE FROM incidents WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    }));

    // 款号变更历史
    router.get('/style-logs', asyncHandler((req, res) => {
        const rows = query('SELECT id, line_id as lineId, from_style as fromStyle, to_style as toStyle, changed_at as changedAt FROM style_change_logs ORDER BY changed_at DESC');
        res.json(rows);
    }));

    router.get('/style-logs/:lineId', asyncHandler((req, res) => {
        const rows = queryWithParams('SELECT id, line_id as lineId, from_style as fromStyle, to_style as toStyle, changed_at as changedAt FROM style_change_logs WHERE line_id = ? ORDER BY changed_at DESC LIMIT 10', [parseInt(req.params.lineId, 10)]);
        res.json(rows);
    }));

    // 数据备份
    router.get('/backup', asyncHandler((req, res) => {
        const data = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            orders: query('SELECT id, date, client, style_no, package_spec, pi_no, line_id, line_ids, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, workshop_note, prep_days_required, warehouse_allocation, created_at FROM orders'),
            inventory: query('SELECT id, style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today, safety_stock, last_updated, line_id, line_name FROM inventory'),
            production_lines: query('SELECT id, name, status, current_style, daily_capacity, export_capacity, note, style_changed_at, sub_lines FROM production_lines'),
            styles: query('SELECT id, style_no, name, category, unit_weight, note, created_at FROM styles'),
            incidents: query('SELECT id, timestamp, style_no, order_client, reported_by, reason, note, resolved, resolved_at FROM incidents'),
            customers: query('SELECT id, name, contact_person, phone, email, address, note, created_at, updated_at FROM customers'),
            inventory_transactions: query('SELECT id, style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id, created_at FROM inventory_transactions ORDER BY created_at DESC LIMIT 2000'),
            inventory_audit_logs: query('SELECT id, style_no, warehouse_type, package_spec, line_id, line_name, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator, created_at FROM inventory_audit_logs ORDER BY created_at DESC LIMIT 1000'),
            style_change_logs: query('SELECT id, line_id, from_style, to_style, changed_at FROM style_change_logs ORDER BY changed_at DESC LIMIT 500'),
        };
        res.setHeader('Content-Disposition', `attachment; filename=syncflow_backup_${new Date().toISOString().split('T')[0]}.json`);
        res.json(data);
    }));

    // 数据恢复
    router.post('/restore', asyncHandler((req, res) => {
        const confirmToken = req.headers['x-confirm-restore'];
        if (confirmToken !== 'CONFIRM_RESTORE') return res.status(403).json({ error: '危险操作：需要确认令牌', requiredHeader: 'X-Confirm-Restore: CONFIRM_RESTORE' });
        const data = req.body;
        if (!data.version || !data.orders) return res.status(400).json({ error: '无效的备份文件格式' });
        withTransaction(() => {
            const db = getDb();
            db.exec('DELETE FROM orders');
            db.exec('DELETE FROM inventory');
            db.exec('DELETE FROM production_lines');
            db.exec('DELETE FROM styles');
            db.exec('DELETE FROM incidents');
            db.exec('DELETE FROM customers');
            db.exec('DELETE FROM inventory_transactions');
            db.exec('DELETE FROM inventory_audit_logs');
            db.exec('DELETE FROM style_change_logs');
            data.orders?.forEach(o => runNoSave('INSERT INTO orders (id, date, client, style_no, package_spec, pi_no, line_id, line_ids, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, workshop_note, prep_days_required, warehouse_allocation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [o.id, o.date, o.client, o.style_no, o.package_spec || null, o.pi_no, o.line_id, o.line_ids || null, o.bl_no, o.total_tons, o.containers, o.packages_per_container, o.port, o.contact_person, o.trade_type, o.requirements, o.status, o.is_large_order, o.large_order_ack, o.loading_time_slot, o.expected_ship_date, o.workshop_comm_status, o.workshop_note, o.prep_days_required, o.warehouse_allocation || null, o.created_at || new Date().toISOString()]));
            data.inventory?.forEach(i => runNoSave('INSERT INTO inventory (id, style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today, safety_stock, last_updated, line_id, line_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [i.id, i.style_no, i.warehouse_type || 'general', i.package_spec || '820kg', i.current_stock, i.grade_a || 0, i.grade_b || 0, i.stock_t_minus_1 || 0, i.locked_for_today || 0, i.safety_stock || 0, i.last_updated || new Date().toISOString(), i.line_id || null, i.line_name || null]));
            data.production_lines?.forEach(l => runNoSave('INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity, note, style_changed_at, sub_lines) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [l.id, l.name, l.status, l.current_style, l.daily_capacity, l.export_capacity, l.note, l.style_changed_at, l.sub_lines]));
            data.styles?.forEach(s => runNoSave('INSERT INTO styles (id, style_no, name, category, unit_weight, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [s.id, s.style_no, s.name, s.category, s.unit_weight, s.note, s.created_at || new Date().toISOString()]));
            data.incidents?.forEach(i => runNoSave('INSERT INTO incidents (id, timestamp, style_no, order_client, reported_by, reason, note, resolved, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [i.id, i.timestamp, i.style_no, i.order_client, i.reported_by, i.reason, i.note, i.resolved, i.resolved_at]));
            data.customers?.forEach(c => runNoSave('INSERT INTO customers (id, name, contact_person, phone, email, address, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [c.id, c.name, c.contact_person, c.phone, c.email, c.address, c.note, c.created_at, c.updated_at]));
            data.inventory_transactions?.forEach(t => runNoSave('INSERT INTO inventory_transactions (id, style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [t.id, t.style_no, t.warehouse_type, t.package_spec, t.type, t.grade, t.quantity, t.balance, t.source, t.note, t.order_id, t.created_at]));
            data.inventory_audit_logs?.forEach(a => runNoSave('INSERT INTO inventory_audit_logs (id, style_no, warehouse_type, package_spec, line_id, line_name, action, before_grade_a, before_grade_b, after_grade_a, after_grade_b, reason, operator, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [a.id, a.style_no, a.warehouse_type, a.package_spec, a.line_id, a.line_name, a.action, a.before_grade_a, a.before_grade_b, a.after_grade_a, a.after_grade_b, a.reason, a.operator, a.created_at]));
            data.style_change_logs?.forEach(l => runNoSave('INSERT INTO style_change_logs (id, line_id, from_style, to_style, changed_at) VALUES (?, ?, ?, ?, ?)', [l.id, l.line_id, l.from_style, l.to_style, l.changed_at]));
        });
        res.json({ success: true, message: `已恢复: 订单${data.orders?.length || 0}条, 库存${data.inventory?.length || 0}条, 客户${data.customers?.length || 0}条` });
    }));

    return router;
};

export default setupMiscRoutes;
