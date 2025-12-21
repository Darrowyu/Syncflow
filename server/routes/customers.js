import { Router } from 'express';

const router = Router();

export const setupCustomerRoutes = (queryWithParams, query, run, asyncHandler) => {
    // 客户列表
    router.get('/', asyncHandler((req, res) => {
        const rows = query('SELECT id, name, contact_person as contactPerson, phone, email, address, note, created_at as createdAt, updated_at as updatedAt FROM customers ORDER BY name');
        res.json(rows);
    }));

    // 客户详情
    router.get('/:id', asyncHandler((req, res) => {
        const customer = queryWithParams('SELECT id, name, contact_person as contactPerson, phone, email, address, note, created_at as createdAt, updated_at as updatedAt FROM customers WHERE id = ?', [parseInt(req.params.id, 10)])[0];
        if (!customer) return res.status(404).json({ error: '客户不存在' });
        res.json(customer);
    }));

    // 客户统计
    router.get('/:id/stats', asyncHandler((req, res) => {
        const customerId = parseInt(req.params.id, 10);
        const customer = queryWithParams('SELECT name FROM customers WHERE id = ?', [customerId])[0];
        if (!customer) return res.status(404).json({ error: '客户不存在' });
        const stats = queryWithParams(`SELECT COUNT(*) as orderCount, COALESCE(SUM(total_tons), 0) as totalTons, COALESCE(SUM(containers), 0) as totalContainers, MIN(date) as firstOrderDate, MAX(date) as lastOrderDate FROM orders WHERE client = ?`, [customer.name])[0];
        const topStyles = queryWithParams(`SELECT style_no as styleNo, SUM(total_tons) as tons FROM orders WHERE client = ? GROUP BY style_no ORDER BY tons DESC LIMIT 5`, [customer.name]);
        res.json({ customerId, customerName: customer.name, ...stats, topStyles });
    }));

    // 客户订单
    router.get('/:id/orders', asyncHandler((req, res) => {
        const customerId = parseInt(req.params.id, 10);
        const customer = queryWithParams('SELECT name FROM customers WHERE id = ?', [customerId])[0];
        if (!customer) return res.status(404).json({ error: '客户不存在' });
        const rows = queryWithParams('SELECT id, date, style_no as styleNo, pi_no as piNo, total_tons as totalTons, containers, port, status FROM orders WHERE client = ? ORDER BY date DESC', [customer.name]);
        res.json(rows);
    }));

    // 创建客户
    router.post('/', asyncHandler((req, res) => {
        const { name, contactPerson, phone, email, address, note } = req.body;
        if (!name) return res.status(400).json({ error: '客户名称必填' });
        const existing = queryWithParams('SELECT id FROM customers WHERE name = ?', [name])[0];
        if (existing) return res.status(400).json({ error: '客户已存在' });
        run('INSERT INTO customers (name, contact_person, phone, email, address, note) VALUES (?, ?, ?, ?, ?, ?)', [name, contactPerson || null, phone || null, email || null, address || null, note || null]);
        const newCustomer = queryWithParams('SELECT id FROM customers WHERE name = ?', [name])[0];
        res.json({ success: true, id: newCustomer?.id });
    }));

    // 更新客户
    router.put('/:id', asyncHandler((req, res) => {
        const { name, contactPerson, phone, email, address, note } = req.body;
        run('UPDATE customers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, note = ?, updated_at = ? WHERE id = ?', [name, contactPerson || null, phone || null, email || null, address || null, note || null, new Date().toISOString(), parseInt(req.params.id, 10)]);
        res.json({ success: true });
    }));

    // 删除客户
    router.delete('/:id', asyncHandler((req, res) => {
        run('DELETE FROM customers WHERE id = ?', [parseInt(req.params.id, 10)]);
        res.json({ success: true });
    }));

    // 从订单同步客户
    router.post('/sync', asyncHandler((req, res) => {
        const clients = query("SELECT DISTINCT client FROM orders WHERE client IS NOT NULL AND client != ''");
        let created = 0;
        clients.forEach(({ client }) => {
            const existing = queryWithParams('SELECT id FROM customers WHERE name = ?', [client])[0];
            if (!existing) { run('INSERT INTO customers (name) VALUES (?)', [client]); created++; }
        });
        res.json({ success: true, synced: clients.length, created });
    }));

    return router;
};

export default setupCustomerRoutes;
