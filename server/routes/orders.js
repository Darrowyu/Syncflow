import { Router } from 'express';

const router = Router();

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

    // 删除订单
    router.delete('/:id', asyncHandler((req, res) => {
        run('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    }));

    return router;
};

export default setupOrderRoutes;
