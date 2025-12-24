import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { initDatabase, getDb } from './db/init.js';
import { rateLimitMiddleware, asyncHandler, errorHandler } from './middleware/index.js';
import { setupInventoryRoutes } from './routes/inventory.js';
import { setupOrderRoutes } from './routes/orders.js';
import { setupLineRoutes } from './routes/lines.js';
import { setupCustomerRoutes } from './routes/customers.js';
import { setupMiscRoutes } from './routes/misc.js';

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

// 请求限流中间件
app.use(rateLimitMiddleware);

// 初始化数据库
await initDatabase();

// 数据库辅助函数
const queryWithParams = (sql, params = []) => {
  const db = getDb();
  return db.prepare(sql).all(params);
};
const query = (sql) => queryWithParams(sql, []);
const run = (sql, params = []) => { const db = getDb(); db.prepare(sql).run(params); };
const runNoSave = (sql, params = []) => { const db = getDb(); db.prepare(sql).run(params); };

const withTransaction = (operations) => {
  const db = getDb();
  const tx = db.transaction(operations);
  return tx();
};

// 挂载路由模块
app.use('/api/inventory', setupInventoryRoutes(queryWithParams, query, run, runNoSave, withTransaction, asyncHandler));
app.use('/api/orders', setupOrderRoutes(queryWithParams, query, run, runNoSave, withTransaction, asyncHandler));
app.use('/api/lines', setupLineRoutes(queryWithParams, query, run, asyncHandler));
app.use('/api/customers', setupCustomerRoutes(queryWithParams, query, run, asyncHandler));
app.use('/api', setupMiscRoutes(queryWithParams, query, run, runNoSave, withTransaction, asyncHandler, getDb, existsSync, mkdirSync, writeFileSync, join, __dirname));

// 全局错误处理
app.use(errorHandler);

// SPA路由：所有非API请求返回index.html
if (existsSync(distPath)) {
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

// 每日自动备份功能
const BACKUP_DIR = join(__dirname, 'backups');
const BACKUP_HOUR = 3;
const BACKUP_KEEP_DAYS = 30;

const performBackup = () => {
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      orders: query('SELECT id, date, client, style_no, package_spec, pi_no, line_id, line_ids, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, workshop_note, prep_days_required, warehouse_allocation, created_at FROM orders'),
      inventory: query('SELECT id, style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today, safety_stock, last_updated, line_id, line_name FROM inventory'),
      production_lines: query('SELECT id, name, status, current_style, daily_capacity, export_capacity, note, style_changed_at, sub_lines FROM production_lines'),
      styles: query('SELECT id, style_no, name, category, unit_weight, note, created_at FROM styles'),
      incidents: query('SELECT id, timestamp, style_no, order_client, reported_by, reason, note, resolved, resolved_at FROM incidents'),
      customers: query('SELECT id, name, contact_person, phone, email, address, note, created_at, updated_at FROM customers'),
    };
    const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(join(BACKUP_DIR, filename), JSON.stringify(data, null, 2));
    console.log(`[Auto Backup] 备份成功: ${filename}`);
    cleanOldBackups();
  } catch (e) { console.error('[Auto Backup] 备份失败:', e.message); }
};

const cleanOldBackups = () => {
  try {
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

const scheduleNextBackup = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(BACKUP_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  console.log(`[Auto Backup] 下次备份时间: ${next.toLocaleString()}`);
  setTimeout(() => {
    performBackup();
    setInterval(performBackup, 24 * 60 * 60 * 1000);
  }, delay);
};

const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  scheduleNextBackup();
  const todayBackup = join(BACKUP_DIR, `backup_${new Date().toISOString().split('T')[0]}.json`);
  if (!existsSync(todayBackup)) performBackup();
});
