import { Router } from 'express';

const router = Router();

export const setupLineRoutes = (queryWithParams, query, run, asyncHandler) => {
    // 产线列表
    router.get('/', asyncHandler((req, res) => {
        const rows = query('SELECT id, name, status, current_style as currentStyle, daily_capacity as dailyCapacity, export_capacity as exportCapacity, note, style_changed_at as styleChangedAt, sub_lines as subLines FROM production_lines ORDER BY id');
        res.json(rows.map(r => ({ ...r, subLines: r.subLines ? JSON.parse(r.subLines) : [] })));
    }));

    // 创建产线
    router.post('/', asyncHandler((req, res) => {
        const { name, status, currentStyle, dailyCapacity, exportCapacity, note, subLines } = req.body;
        const maxId = query('SELECT MAX(id) as maxId FROM production_lines')[0]?.maxId || 0;
        const newId = maxId + 1;
        run('INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity, note, sub_lines) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, name || `Line ${newId}`, status || 'Stopped', currentStyle || '-', dailyCapacity || 0, exportCapacity || 0, note || null, subLines ? JSON.stringify(subLines) : null]);
        res.json({ success: true, id: newId });
    }));

    // 更新产线
    router.put('/:id', asyncHandler((req, res) => {
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

    // 删除产线
    router.delete('/:id', asyncHandler((req, res) => {
        run('DELETE FROM production_lines WHERE id = ?', [parseInt(req.params.id, 10)]);
        res.json({ success: true });
    }));

    return router;
};

// 款号变更历史路由
export const setupStyleLogRoutes = (queryWithParams, query, asyncHandler) => {
    router.get('/', asyncHandler((req, res) => {
        const rows = query('SELECT id, line_id as lineId, from_style as fromStyle, to_style as toStyle, changed_at as changedAt FROM style_change_logs ORDER BY changed_at DESC');
        res.json(rows);
    }));

    router.get('/:lineId', asyncHandler((req, res) => {
        const rows = queryWithParams('SELECT id, line_id as lineId, from_style as fromStyle, to_style as toStyle, changed_at as changedAt FROM style_change_logs WHERE line_id = ? ORDER BY changed_at DESC LIMIT 10', [parseInt(req.params.lineId, 10)]);
        res.json(rows);
    }));

    return router;
};

export default setupLineRoutes;
