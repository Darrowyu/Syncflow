import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'syncflow.db');

let db = null;

export async function initDatabase() {
  // better-sqlite3 是同步的，直接打开数据库文件（如果不存在会自动创建）
  db = new Database(DB_PATH);

  // 基础表结构迁移逻辑
  db.exec("CREATE TABLE IF NOT EXISTS styles (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT UNIQUE NOT NULL, name TEXT, category TEXT, unit_weight REAL DEFAULT 0, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

  // 迁移：添加style_changed_at列
  try { db.exec("ALTER TABLE production_lines ADD COLUMN style_changed_at TEXT"); } catch (e) { }

  // 迁移：创建款号变更历史表
  db.exec("CREATE TABLE IF NOT EXISTS style_change_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, line_id INTEGER NOT NULL, from_style TEXT, to_style TEXT NOT NULL, changed_at TEXT NOT NULL)");

  // 迁移：添加export_capacity和sub_lines列
  try { db.exec("ALTER TABLE production_lines ADD COLUMN export_capacity REAL DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE production_lines ADD COLUMN sub_lines TEXT"); } catch (e) { }

  // 迁移：从产线表中提取正在使用的款号，自动添加到款号维护表
  try {
    const lines = db.prepare("SELECT current_style, sub_lines FROM production_lines").all();
    const usedStyles = new Set();
    lines.forEach(row => {
      const currentStyle = row.current_style;
      const subLinesJson = row.sub_lines;
      if (currentStyle && currentStyle !== '-') usedStyles.add(currentStyle);
      if (subLinesJson) {
        try {
          const subLines = JSON.parse(subLinesJson);
          subLines.forEach(sub => { if (sub.currentStyle && sub.currentStyle !== '-') usedStyles.add(sub.currentStyle); });
        } catch (e) { }
      }
    });
    usedStyles.forEach(styleNo => {
      db.prepare("INSERT OR IGNORE INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run(styleNo, '', '', 0, '自动从产线导入');
    });
  } catch (e) { console.error('Style migration error:', e); }

  // 迁移：添加current_stock列和库存流水表
  try { db.exec("ALTER TABLE inventory ADD COLUMN current_stock REAL DEFAULT 0"); } catch (e) { }
  db.exec("CREATE TABLE IF NOT EXISTS inventory_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, balance REAL NOT NULL, source TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

  // 迁移：添加库存等级字段 grade_a(优等品) grade_b(一等品)
  try { db.exec("ALTER TABLE inventory ADD COLUMN grade_a REAL DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory ADD COLUMN grade_b REAL DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN grade TEXT DEFAULT 'A'"); } catch (e) { }

  // 初始化等级数据
  try { db.exec("UPDATE inventory SET grade_a = current_stock WHERE grade_a = 0 AND current_stock > 0"); } catch (e) { }

  // 迁移：添加仓库类型和包装规格字段
  try { db.exec("ALTER TABLE inventory ADD COLUMN warehouse_type TEXT DEFAULT 'general'"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory ADD COLUMN package_spec TEXT DEFAULT '820kg'"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN warehouse_type TEXT DEFAULT 'general'"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN package_spec TEXT DEFAULT '820kg'"); } catch (e) { }

  // 迁移：重建inventory表以支持复合唯一约束
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory'").get();
    const sql = tableInfo ? tableInfo.sql : '';
    const needsRebuild = sql && !sql.includes('UNIQUE(style_no, warehouse_type, package_spec, line_id)');
    if (needsRebuild) {
      console.log('[Migration] Rebuilding inventory table...');
      db.transaction(() => {
        db.exec("ALTER TABLE inventory RENAME TO inventory_old");
        db.exec("CREATE TABLE inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT NOT NULL, warehouse_type TEXT DEFAULT 'general', package_spec TEXT DEFAULT '820kg', current_stock REAL DEFAULT 0, grade_a REAL DEFAULT 0, grade_b REAL DEFAULT 0, stock_t_minus_1 REAL DEFAULT 0, locked_for_today REAL DEFAULT 0, safety_stock REAL DEFAULT 0, last_updated TEXT, line_id INTEGER, line_name TEXT, UNIQUE(style_no, warehouse_type, package_spec, line_id))");
        db.exec("INSERT INTO inventory (style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today, safety_stock, last_updated, line_id, line_name) SELECT style_no, COALESCE(warehouse_type, 'general'), COALESCE(package_spec, '820kg'), current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today, COALESCE(safety_stock, 0), last_updated, line_id, line_name FROM inventory_old");
        db.exec("DROP TABLE inventory_old");
      })();
    }
  } catch (e) { console.error('[Migration] Inventory table rebuild error:', e.message); }

  // 其他迁移逻辑继续...
  try { db.exec("ALTER TABLE incidents ADD COLUMN resolved INTEGER DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE incidents ADD COLUMN resolved_at TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory ADD COLUMN safety_stock REAL DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory ADD COLUMN last_updated TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN order_id TEXT"); } catch (e) { }

  db.exec("CREATE TABLE IF NOT EXISTS inventory_audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT NOT NULL, warehouse_type TEXT DEFAULT 'general', package_spec TEXT DEFAULT '820kg', line_id INTEGER, line_name TEXT, action TEXT NOT NULL, before_grade_a REAL DEFAULT 0, before_grade_b REAL DEFAULT 0, after_grade_a REAL DEFAULT 0, after_grade_b REAL DEFAULT 0, reason TEXT, operator TEXT DEFAULT 'system', created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

  try { db.exec("ALTER TABLE inventory_audit_logs ADD COLUMN line_id INTEGER"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory_audit_logs ADD COLUMN line_name TEXT"); } catch (e) { }
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_line_id ON inventory_audit_logs(line_id)");
  try { db.exec("ALTER TABLE orders ADD COLUMN line_ids TEXT"); } catch (e) { }

  // 索引优化
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_style_no ON orders(style_no)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_style_no ON inventory_transactions(style_no)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_incidents_style_no ON incidents(style_no)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_style_change_logs_line_id ON style_change_logs(line_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_id ON inventory_transactions(order_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_style_no ON inventory_audit_logs(style_no)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_safety_stock ON inventory(safety_stock)");

  try { db.exec("ALTER TABLE orders ADD COLUMN package_spec TEXT"); } catch (e) { }
  db.exec("CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client)");
  try { db.exec("ALTER TABLE orders ADD COLUMN warehouse_allocation TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory ADD COLUMN line_id INTEGER"); } catch (e) { }
  try { db.exec("ALTER TABLE inventory ADD COLUMN line_name TEXT"); } catch (e) { }

  // 从订单中提取客户
  try {
    const clients = db.prepare("SELECT DISTINCT client FROM orders WHERE client IS NOT NULL AND client != ''").all();
    clients.forEach(row => {
      if (row.client) db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(row.client);
    });
  } catch (e) { console.error('Customer migration error:', e); }

  // 如果是空数据库，初始化种子数据
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").get();
  if (!tableCheck) {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);
    seedData(db);
  }

  return db;
}

export function getDb() { return db; }

// better-sqlite3 自动持久化，saveDatabase 变为 no-op
export function saveDatabase() {
  // console.log('Database automatically saved by better-sqlite3');
}

function seedData(db) {
  db.prepare("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES (?, ?, ?, ?)").run('BE3250', 80, 80, 0);
  db.prepare("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES (?, ?, ?, ?)").run('BE2250', 5, 5, 0);
  db.prepare("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES (?, ?, ?, ?)").run('BE3340', 250, 250, 0);

  const line2SubLines = JSON.stringify([{ id: 'sub-2-1', name: '大管', currentStyle: 'BE3250', dailyCapacity: 30, exportCapacity: 15 }, { id: 'sub-2-2', name: 'SSP-1', currentStyle: 'BE2250', dailyCapacity: 15, exportCapacity: 8 }]);
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (1, 'Line 1', 'Running', 'BE3250', 50, 30)").run();
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity, sub_lines) VALUES (2, 'Line 2', 'Running', '-', 45, 23, ?)").run(line2SubLines);
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (3, 'Line 3', 'Running', 'BE2250', 40, 8)").run();
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (4, 'Line 4', 'Stopped', '-', 0, 0)").run();
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (5, 'Line 5', 'Running', 'BE3340', 60, 48)").run();
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (6, 'Line 6', 'Running', 'BE3340', 55, 38)").run();
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (7, 'Line 7', 'Maintenance', '-', 0, 0)").run();
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (8, 'Line 8', 'Running', 'BE3250', 40, 20)").run();
  db.prepare("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (9, 'Line 9', 'Running', 'BE2250', 35, 14)").run();

  db.prepare("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('1', '2023-11-29', 'BGF', 'BE3250', 'Z32025101631363', 1, '285753431', 123, 5, 30, 'Incheon', 'Wang Fujing', 'General Trade', '820KG Export Pack, Plywood Pallet, Film, Stock, Rail/Sea', 'Pending', 1, 1, 'Morning', '2023-11-29', 'Confirmed', 2);
  db.prepare("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('2', '2023-11-29', 'BAIKSAN LINTEX', 'BE2250', '232025112232176', 3, '285753347', 22.96, 1, 28, 'Busan', 'Wang Fujing', 'General Trade', '820KG Export Pack, Plywood Pallet, Film, Stock, Premium', 'Confirmed', 0, 0, 'Afternoon', '2023-11-29', 'Confirmed', 0);
  db.prepare("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run('3', '2023-11-29', 'PT FILAMENDO', 'BE3340', 'Z32025093031198', 5, '177IKHKHS22941', 209.92, 8, 32, 'Jakarta', 'TRACY', 'Bonded', '820KG Export Pack, Molded Pallet, Film, Stock, Manual #614, Rail/Sea', 'Confirmed', 1, 0, 'Morning', '2023-11-30', 'InProgress', 3);

  db.prepare("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run('BE3250', '标准管材', 'A类', 820, '常规出口款');
  db.prepare("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run('BE2250', '小管材', 'B类', 820, '高端出口款');
  db.prepare("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run('BE3340', '大管材', 'A类', 820, '大批量出口款');

  console.log('Database seeded with initial data');
}
