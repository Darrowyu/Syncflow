import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'syncflow.db');

let db = null;
let SQL = null;

// 封装 prepare 方法，兼容 better-sqlite3 的 API
function createStatement(sql) {
  return {
    run: (...params) => {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      db.run(sql, flatParams.length > 0 ? flatParams : undefined);
      saveDatabase();
    },
    get: (...params) => {
      const stmt = db.prepare(sql);
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (flatParams.length > 0) stmt.bind(flatParams);
      const result = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return result;
    },
    all: (...params) => {
      const results = [];
      const stmt = db.prepare(sql);
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (flatParams.length > 0) stmt.bind(flatParams);
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    }
  };
}

// 封装 db 对象，提供 better-sqlite3 兼容接口
function wrapDb(rawDb) {
  return {
    exec: (sql) => { rawDb.exec(sql); saveDatabase(); },
    prepare: (sql) => createStatement(sql),
    transaction: (fn) => () => { try { rawDb.exec('BEGIN'); fn(); rawDb.exec('COMMIT'); saveDatabase(); } catch (e) { rawDb.exec('ROLLBACK'); throw e; } },
    run: (sql, params) => { rawDb.run(sql, params); saveDatabase(); },
    _raw: rawDb // 保留原始引用
  };
}

export async function initDatabase() {
  SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const wrappedDb = wrapDb(db);

  // 先检查是否是全新数据库，如果是则先创建基础表结构
  const ordersTableCheck = wrappedDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").get();
  if (!ordersTableCheck) {
    console.log('[DB] 检测到新数据库，正在创建表结构...');
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);
    seedData(wrappedDb);
    saveDatabase();
    console.log('[DB] 数据库初始化完成');
    return wrappedDb;
  }

  // 以下是针对已有数据库的迁移逻辑
  db.exec("CREATE TABLE IF NOT EXISTS styles (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT UNIQUE NOT NULL, name TEXT, category TEXT, unit_weight REAL DEFAULT 0, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

  // 迁移：添加style_changed_at列
  try { db.exec("ALTER TABLE production_lines ADD COLUMN style_changed_at TEXT"); } catch (e) { console.log('[Migration] style_changed_at column may already exist'); }

  // 迁移：创建款号变更历史表
  db.exec("CREATE TABLE IF NOT EXISTS style_change_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, line_id INTEGER NOT NULL, from_style TEXT, to_style TEXT NOT NULL, changed_at TEXT NOT NULL)");

  // 迁移：添加export_capacity和sub_lines列
  try { db.exec("ALTER TABLE production_lines ADD COLUMN export_capacity REAL DEFAULT 0"); } catch (e) { console.log('[Migration] export_capacity column may already exist'); }
  try { db.exec("ALTER TABLE production_lines ADD COLUMN sub_lines TEXT"); } catch (e) { console.log('[Migration] sub_lines column may already exist'); }

  // 迁移：从产线表中提取正在使用的款号，自动添加到款号维护表
  try {
    const lines = wrappedDb.prepare("SELECT current_style, sub_lines FROM production_lines").all();
    const usedStyles = new Set();
    lines.forEach(row => {
      const currentStyle = row.current_style;
      const subLinesJson = row.sub_lines;
      if (currentStyle && currentStyle !== '-') usedStyles.add(currentStyle);
      if (subLinesJson) {
        try {
          const subLines = JSON.parse(subLinesJson);
          subLines.forEach(sub => { if (sub.currentStyle && sub.currentStyle !== '-') usedStyles.add(sub.currentStyle); });
        } catch (e) { console.log('[Migration] Failed to parse subLines JSON:', e.message); }
      }
    });
    usedStyles.forEach(styleNo => {
      wrappedDb.prepare("INSERT OR IGNORE INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run(styleNo, '', '', 0, '自动从产线导入');
    });
  } catch (e) { console.error('Style migration error:', e); }

  // 迁移：添加current_stock列和库存流水表
  try { db.exec("ALTER TABLE inventory ADD COLUMN current_stock REAL DEFAULT 0"); } catch (e) { console.log('[Migration] current_stock column may already exist'); }
  db.exec("CREATE TABLE IF NOT EXISTS inventory_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, balance REAL NOT NULL, source TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

  // 迁移：添加库存等级字段 grade_a(优等品) grade_b(一等品)
  try { db.exec("ALTER TABLE inventory ADD COLUMN grade_a REAL DEFAULT 0"); } catch (e) { console.log('[Migration] grade_a column may already exist'); }
  try { db.exec("ALTER TABLE inventory ADD COLUMN grade_b REAL DEFAULT 0"); } catch (e) { console.log('[Migration] grade_b column may already exist'); }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN grade TEXT DEFAULT 'A'"); } catch (e) { console.log('[Migration] grade column may already exist'); }

  // 初始化等级数据
  try { db.exec("UPDATE inventory SET grade_a = current_stock WHERE grade_a = 0 AND current_stock > 0"); } catch (e) { console.log('[Migration] Failed to initialize grade_a data:', e.message); }

  // 迁移：添加仓库类型和包装规格字段
  try { db.exec("ALTER TABLE inventory ADD COLUMN warehouse_type TEXT DEFAULT 'general'"); } catch (e) { console.log('[Migration] warehouse_type column may already exist'); }
  try { db.exec("ALTER TABLE inventory ADD COLUMN package_spec TEXT DEFAULT '820kg'"); } catch (e) { console.log('[Migration] package_spec column may already exist'); }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN warehouse_type TEXT DEFAULT 'general'"); } catch (e) { console.log('[Migration] warehouse_type(transaction) column may already exist'); }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN package_spec TEXT DEFAULT '820kg'"); } catch (e) { console.log('[Migration] package_spec(transaction) column may already exist'); }

  // 迁移：重建inventory表以支持复合唯一约束
  try {
    const tableInfo = wrappedDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory'").get();
    const sql = tableInfo ? tableInfo.sql : '';
    const needsRebuild = sql && !sql.includes('UNIQUE(style_no, warehouse_type, package_spec, line_id)');
    if (needsRebuild) {
      console.log('[Migration] Rebuilding inventory table...');
      db.exec("BEGIN");
      try {
        db.exec("ALTER TABLE inventory RENAME TO inventory_old");
        db.exec("CREATE TABLE inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT NOT NULL, warehouse_type TEXT DEFAULT 'general', package_spec TEXT DEFAULT '820kg', current_stock REAL DEFAULT 0, grade_a REAL DEFAULT 0, grade_b REAL DEFAULT 0, stock_t_minus_1 REAL DEFAULT 0, locked_for_today REAL DEFAULT 0, safety_stock REAL DEFAULT 0, last_updated TEXT, line_id INTEGER, line_name TEXT, UNIQUE(style_no, warehouse_type, package_spec, line_id))");
        db.exec("INSERT INTO inventory (style_no, warehouse_type, package_spec, current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today, safety_stock, last_updated, line_id, line_name) SELECT style_no, COALESCE(warehouse_type, 'general'), COALESCE(package_spec, '820kg'), current_stock, grade_a, grade_b, stock_t_minus_1, locked_for_today, COALESCE(safety_stock, 0), last_updated, line_id, line_name FROM inventory_old");
        db.exec("DROP TABLE inventory_old");
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        console.error('[Migration] Inventory table rebuild error:', e.message);
      }
    }
  } catch (e) { console.error('[Migration] Inventory table rebuild error:', e.message); }

  // 其他迁移逻辑继续...
  try { db.exec("ALTER TABLE incidents ADD COLUMN resolved INTEGER DEFAULT 0"); } catch (e) { console.log('[Migration] resolved column may already exist'); }
  try { db.exec("ALTER TABLE incidents ADD COLUMN resolved_at TEXT"); } catch (e) { console.log('[Migration] resolved_at column may already exist'); }
  try { db.exec("ALTER TABLE inventory ADD COLUMN safety_stock REAL DEFAULT 0"); } catch (e) { console.log('[Migration] safety_stock column may already exist'); }
  try { db.exec("ALTER TABLE inventory ADD COLUMN last_updated TEXT"); } catch (e) { console.log('[Migration] last_updated column may already exist'); }
  try { db.exec("ALTER TABLE inventory_transactions ADD COLUMN order_id TEXT"); } catch (e) { console.log('[Migration] order_id column may already exist'); }

  db.exec("CREATE TABLE IF NOT EXISTS inventory_audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT NOT NULL, warehouse_type TEXT DEFAULT 'general', package_spec TEXT DEFAULT '820kg', line_id INTEGER, line_name TEXT, action TEXT NOT NULL, before_grade_a REAL DEFAULT 0, before_grade_b REAL DEFAULT 0, after_grade_a REAL DEFAULT 0, after_grade_b REAL DEFAULT 0, reason TEXT, operator TEXT DEFAULT 'system', created_at TEXT DEFAULT CURRENT_TIMESTAMP)");

  try { db.exec("ALTER TABLE inventory_audit_logs ADD COLUMN line_id INTEGER"); } catch (e) { console.log('[Migration] line_id(audit_logs) column may already exist'); }
  try { db.exec("ALTER TABLE inventory_audit_logs ADD COLUMN line_name TEXT"); } catch (e) { console.log('[Migration] line_name(audit_logs) column may already exist'); }
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_line_id ON inventory_audit_logs(line_id)");
  try { db.exec("ALTER TABLE orders ADD COLUMN line_ids TEXT"); } catch (e) { console.log('[Migration] line_ids column may already exist'); }

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

  try { db.exec("ALTER TABLE orders ADD COLUMN package_spec TEXT"); } catch (e) { console.log('[Migration] package_spec(orders) column may already exist'); }
  db.exec("CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client)");
  try { db.exec("ALTER TABLE orders ADD COLUMN warehouse_allocation TEXT"); } catch (e) { console.log('[Migration] warehouse_allocation column may already exist'); }
  try { db.exec("ALTER TABLE inventory ADD COLUMN line_id INTEGER"); } catch (e) { console.log('[Migration] line_id(inventory) column may already exist'); }
  try { db.exec("ALTER TABLE inventory ADD COLUMN line_name TEXT"); } catch (e) { console.log('[Migration] line_name(inventory) column may already exist'); }

  // 从订单中提取客户
  try {
    const clients = wrappedDb.prepare("SELECT DISTINCT client FROM orders WHERE client IS NOT NULL AND client != ''").all();
    clients.forEach(row => {
      if (row.client) wrappedDb.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(row.client);
    });
  } catch (e) { console.error('Customer migration error:', e); }

  saveDatabase();
  return wrappedDb;
}

export function getDb() {
  if (!db) return null;
  return wrapDb(db);
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

function seedData(wrappedDb) {
  wrappedDb.prepare("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES (?, ?, ?, ?)").run('BE3250', 80, 80, 0);
  wrappedDb.prepare("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES (?, ?, ?, ?)").run('BE2250', 5, 5, 0);
  wrappedDb.prepare("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES (?, ?, ?, ?)").run('BE3340', 250, 250, 0);

  const line2SubLines = JSON.stringify([{ id: 'sub-2-1', name: '大管', currentStyle: 'BE3250', dailyCapacity: 30, exportCapacity: 15 }, { id: 'sub-2-2', name: 'SSP-1', currentStyle: 'BE2250', dailyCapacity: 15, exportCapacity: 8 }]);
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (1, 'Line 1', 'Running', 'BE3250', 50, 30)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity, sub_lines) VALUES (2, 'Line 2', 'Running', '-', 45, 23, ?)", [line2SubLines]);
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (3, 'Line 3', 'Running', 'BE2250', 40, 8)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (4, 'Line 4', 'Stopped', '-', 0, 0)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (5, 'Line 5', 'Running', 'BE3340', 60, 48)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (6, 'Line 6', 'Running', 'BE3340', 55, 38)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (7, 'Line 7', 'Maintenance', '-', 0, 0)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (8, 'Line 8', 'Running', 'BE3250', 40, 20)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (9, 'Line 9', 'Running', 'BE2250', 35, 14)");

  db.run("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['1', '2023-11-29', 'BGF', 'BE3250', 'Z32025101631363', 1, '285753431', 123, 5, 30, 'Incheon', 'Wang Fujing', 'General Trade', '820KG Export Pack, Plywood Pallet, Film, Stock, Rail/Sea', 'Pending', 1, 1, 'Morning', '2023-11-29', 'Confirmed', 2]);
  db.run("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['2', '2023-11-29', 'BAIKSAN LINTEX', 'BE2250', '232025112232176', 3, '285753347', 22.96, 1, 28, 'Busan', 'Wang Fujing', 'General Trade', '820KG Export Pack, Plywood Pallet, Film, Stock, Premium', 'Confirmed', 0, 0, 'Afternoon', '2023-11-29', 'Confirmed', 0]);
  db.run("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['3', '2023-11-29', 'PT FILAMENDO', 'BE3340', 'Z32025093031198', 5, '177IKHKHS22941', 209.92, 8, 32, 'Jakarta', 'TRACY', 'Bonded', '820KG Export Pack, Molded Pallet, Film, Stock, Manual #614, Rail/Sea', 'Confirmed', 1, 0, 'Morning', '2023-11-30', 'InProgress', 3]);

  wrappedDb.prepare("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run('BE3250', '标准管材', 'A类', 820, '常规出口款');
  wrappedDb.prepare("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run('BE2250', '小管材', 'B类', 820, '高端出口款');
  wrappedDb.prepare("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES (?, ?, ?, ?, ?)").run('BE3340', '大管材', 'A类', 820, '大批量出口款');

  saveDatabase();
  console.log('Database seeded with initial data');
}
