import { Router } from 'express';

const router = Router();

// 解析订单产线ID列表
const parseLineIds = (order) => {
    if (order.lineIds) return order.lineIds.split(/[\/,]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (order.lineId) return [order.lineId];
    return [];
};

// 计算订单库存满足率
const calculateFulfillment = (order, queryWithParams) => {
    const lineIds = parseLineIds(order);
    const styleNo = order.styleNo || order.style_no;
    const tradeType = order.tradeType || order.trade_type;
    const totalTons = order.totalTons || order.total_tons || 0;
    const warehouseAllocation = order.warehouseAllocation || (order.warehouse_allocation ? JSON.parse(order.warehouse_allocation) : null);
    
    const getAvailableStock = (whType) => {
        let sql = 'SELECT COALESCE(SUM(current_stock - locked_for_today), 0) as available FROM inventory WHERE style_no = ? AND warehouse_type = ?';
        const params = [styleNo, whType];
        if (lineIds.length > 0) {
            sql += ` AND line_id IN (${lineIds.map(() => '?').join(',')})`;
            params.push(...lineIds);
        }
        const result = queryWithParams(sql, params)[0];
        return Math.max(0, result?.available || 0);
    };
    
    let available = 0;
    if (warehouseAllocation) {
        const generalStock = getAvailableStock('general');
        const bondedStock = getAvailableStock('bonded');
        available = Math.min(warehouseAllocation.general, generalStock) + Math.min(warehouseAllocation.bonded, bondedStock);
    } else {
        const whType = tradeType === 'Bonded' ? 'bonded' : 'general';
        available = getAvailableStock(whType);
    }
    
    return totalTons > 0 ? (available / totalTons) * 100 : 100;
};

export const setupOrderRoutes = (queryWithParams, query, run, runNoSave, withTransaction, asyncHandler) => {
    // 订单列表
    router.get('/', asyncHandler((req, res) => {
        const rows = query('SELECT id, date, client, style_no as styleNo, package_spec as packageSpec, pi_no as piNo, line_id as lineId, line_ids as lineIds, bl_no as blNo, total_tons as totalTons, containers, packages_per_container as packagesPerContainer, port, contact_person as contactPerson, trade_type as tradeType, requirements, status, is_large_order as isLargeOrder, large_order_ack as largeOrderAck, loading_time_slot as loadingTimeSlot, expected_ship_date as expectedShipDate, workshop_comm_status as workshopCommStatus, workshop_note as workshopNote, prep_days_required as prepDaysRequired, warehouse_allocation as warehouseAllocation FROM orders ORDER BY date DESC');
        res.json(rows.map(r => ({ ...r, isLargeOrder: !!r.isLargeOrder, largeOrderAck: !!r.largeOrderAck, warehouseAllocation: r.warehouseAllocation ? JSON.parse(r.warehouseAllocation) : null })));
    }));

    // 创建订单
    router.post('/', asyncHandler((req, res) => {
        const o = req.body;
        const id = o.id || Date.now().toString(36);
        run('INSERT INTO orders (id, date, client, style_no, package_spec, pi_no, line_id, line_ids, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, workshop_note, prep_days_required, warehouse_allocation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, o.date, o.client, o.styleNo, o.packageSpec || null, o.piNo, o.lineId || null, o.lineIds || null, o.blNo, o.totalTons, o.containers || 1, o.packagesPerContainer || 30, o.port, o.contactPerson, o.tradeType, o.requirements, o.status || 'Pending', o.isLargeOrder ? 1 : 0, o.largeOrderAck ? 1 : 0, o.loadingTimeSlot || 'Flexible', o.expectedShipDate || null, o.workshopCommStatus || 'NotStarted', o.workshopNote || null, o.prepDaysRequired || 0, o.warehouseAllocation ? JSON.stringify(o.warehouseAllocation) : null]);
        res.json({ success: true, id });
    }));

    // 更新订单
    router.put('/:id', asyncHandler((req, res) => {
        const o = req.body;
        run('UPDATE orders SET date=?, client=?, style_no=?, package_spec=?, pi_no=?, line_id=?, line_ids=?, bl_no=?, total_tons=?, containers=?, packages_per_container=?, port=?, contact_person=?, trade_type=?, requirements=?, status=?, is_large_order=?, large_order_ack=?, loading_time_slot=?, expected_ship_date=?, workshop_comm_status=?, workshop_note=?, prep_days_required=?, warehouse_allocation=? WHERE id=?',
            [o.date, o.client, o.styleNo, o.packageSpec, o.piNo, o.lineId, o.lineIds, o.blNo, o.totalTons, o.containers, o.packagesPerContainer, o.port, o.contactPerson, o.tradeType, o.requirements, o.status, o.isLargeOrder ? 1 : 0, o.largeOrderAck ? 1 : 0, o.loadingTimeSlot, o.expectedShipDate, o.workshopCommStatus, o.workshopNote, o.prepDaysRequired, o.warehouseAllocation ? JSON.stringify(o.warehouseAllocation) : null, req.params.id]);
        res.json({ success: true });
    }));

    // 部分更新订单
    router.patch('/:id', asyncHandler((req, res) => {
        const updates = req.body;
        const fieldMap = { date: 'date', client: 'client', styleNo: 'style_no', packageSpec: 'package_spec', piNo: 'pi_no', lineId: 'line_id', lineIds: 'line_ids', blNo: 'bl_no', totalTons: 'total_tons', containers: 'containers', packagesPerContainer: 'packages_per_container', port: 'port', contactPerson: 'contact_person', tradeType: 'trade_type', requirements: 'requirements', status: 'status', isLargeOrder: 'is_large_order', largeOrderAck: 'large_order_ack', loadingTimeSlot: 'loading_time_slot', expectedShipDate: 'expected_ship_date', workshopCommStatus: 'workshop_comm_status', workshopNote: 'workshop_note', prepDaysRequired: 'prep_days_required', warehouseAllocation: 'warehouse_allocation' };
        const boolFields = ['isLargeOrder', 'largeOrderAck'];
        const jsonFields = ['warehouseAllocation'];
        
        // 状态切换到ReadyToShip或Shipped时验证库存满足率
        if (updates.status === 'ReadyToShip' || updates.status === 'Shipped') {
            const order = queryWithParams('SELECT * FROM orders WHERE id = ?', [req.params.id])[0];
            if (!order) return res.status(404).json({ error: '订单不存在' });
            if (order.status !== 'ReadyToShip' && order.status !== 'Shipped') {
                const percent = calculateFulfillment(order, queryWithParams);
                if (percent < 100) {
                    return res.status(400).json({ error: `库存不足，当前满足率 ${percent.toFixed(1)}%，需要100%才能切换状态` });
                }
            }
        }
        
        const validUpdates = [];
        for (const [k, v] of Object.entries(updates)) {
            if (!Object.prototype.hasOwnProperty.call(fieldMap, k)) continue;
            let value = v;
            if (boolFields.includes(k)) value = v ? 1 : 0;
            else if (jsonFields.includes(k)) value = v ? JSON.stringify(v) : null;
            validUpdates.push({ field: fieldMap[k], value });
        }
        if (validUpdates.length === 0) return res.json({ success: true });
        withTransaction(() => {
            for (const { field, value } of validUpdates) {
                runNoSave(`UPDATE orders SET ${field} = ? WHERE id = ?`, [value, req.params.id]);
            }
        });
        res.json({ success: true });
    }));

    // 删除订单（已发货订单回滚库存）
    router.delete('/:id', asyncHandler((req, res) => {
        const order = queryWithParams('SELECT * FROM orders WHERE id = ?', [req.params.id])[0];
        if (!order) return res.status(404).json({ error: '订单不存在' });
        
        // 如果订单已发货，检查是否有关联的库存扣减记录并回滚
        if (order.status === 'Shipped') {
            const transactions = queryWithParams('SELECT * FROM inventory_transactions WHERE order_id = ? AND type = ?', [req.params.id, 'OUT']);
            if (transactions.length > 0) {
                withTransaction(() => {
                    for (const tx of transactions) {
                        // 回滚库存：将出库记录对应的数量加回
                        const gradeField = tx.grade === 'B' ? 'grade_b' : 'grade_a';
                        runNoSave(`UPDATE inventory SET current_stock = current_stock + ?, ${gradeField} = ${gradeField} + ?, last_updated = ? WHERE style_no = ? AND warehouse_type = ? AND package_spec = ?`,
                            [tx.quantity, tx.quantity, new Date().toISOString(), tx.style_no, tx.warehouse_type || 'general', tx.package_spec || '820kg']);
                        // 记录回滚流水
                        runNoSave('INSERT INTO inventory_transactions (style_no, warehouse_type, package_spec, type, grade, quantity, balance, source, note, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [tx.style_no, tx.warehouse_type || 'general', tx.package_spec || '820kg', 'IN', tx.grade || 'A', tx.quantity, 0, '订单删除回滚', `订单 ${order.pi_no || order.id} 删除，库存回滚`, req.params.id]);
                    }
                    runNoSave('DELETE FROM orders WHERE id = ?', [req.params.id]);
                });
                return res.json({ success: true, rolledBack: transactions.length, message: `已回滚 ${transactions.length} 条库存记录` });
            }
        }
        
        run('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    }));

    return router;
};

export default setupOrderRoutes;
