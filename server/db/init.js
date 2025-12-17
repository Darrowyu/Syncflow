import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'syncflow.db');

let db = null;

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    // 确保新表存在
    db.run("CREATE TABLE IF NOT EXISTS styles (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT UNIQUE NOT NULL, name TEXT, category TEXT, unit_weight REAL DEFAULT 0, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    // 迁移：添加style_changed_at列
    try { db.run("ALTER TABLE production_lines ADD COLUMN style_changed_at TEXT"); } catch (e) {}
    // 迁移：创建款号变更历史表
    db.run("CREATE TABLE IF NOT EXISTS style_change_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, line_id INTEGER NOT NULL, from_style TEXT, to_style TEXT NOT NULL, changed_at TEXT NOT NULL)");
    // 迁移：添加export_capacity和sub_lines列，移除旧列
    try { db.run("ALTER TABLE production_lines ADD COLUMN export_capacity REAL DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE production_lines ADD COLUMN sub_lines TEXT"); } catch (e) {}
    // 迁移：从产线表中提取正在使用的款号，自动添加到款号维护表
    try {
      const usedStyles = new Set();
      const linesResult = db.exec("SELECT current_style, sub_lines FROM production_lines");
      if (linesResult.length > 0) {
        linesResult[0].values.forEach(row => {
          const currentStyle = row[0];
          const subLinesJson = row[1];
          if (currentStyle && currentStyle !== '-') usedStyles.add(currentStyle);
          if (subLinesJson) {
            try {
              const subLines = JSON.parse(subLinesJson);
              subLines.forEach(sub => { if (sub.currentStyle && sub.currentStyle !== '-') usedStyles.add(sub.currentStyle); });
            } catch (e) {}
          }
        });
      }
      usedStyles.forEach(styleNo => {
        db.run(`INSERT OR IGNORE INTO styles (style_no, name, category, unit_weight, note) VALUES ('${styleNo}', '', '', 0, '自动从产线导入')`);
      });
    } catch (e) { console.error('Style migration error:', e); }
    // 迁移：添加current_stock列和库存流水表
    try { db.run("ALTER TABLE inventory ADD COLUMN current_stock REAL DEFAULT 0"); } catch (e) {}
    db.run("CREATE TABLE IF NOT EXISTS inventory_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, style_no TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, balance REAL NOT NULL, source TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    // 迁移：添加库存等级字段 grade_a(优等品) grade_b(一等品)
    try { db.run("ALTER TABLE inventory ADD COLUMN grade_a REAL DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE inventory ADD COLUMN grade_b REAL DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE inventory_transactions ADD COLUMN grade TEXT DEFAULT 'A'"); } catch (e) {}
    // 初始化等级数据：将现有库存全部设为优等品
    try { db.run("UPDATE inventory SET grade_a = current_stock WHERE grade_a = 0 AND current_stock > 0"); } catch (e) {}
    // 迁移：添加异常记录resolved字段
    try { db.run("ALTER TABLE incidents ADD COLUMN resolved INTEGER DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE incidents ADD COLUMN resolved_at TEXT"); } catch (e) {}
    // 迁移：添加索引优化查询性能
    db.run("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)");
    db.run("CREATE INDEX IF NOT EXISTS idx_orders_style_no ON orders(style_no)");
    db.run("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)");
    db.run("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_style_no ON inventory_transactions(style_no)");
    db.run("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at)");
    db.run("CREATE INDEX IF NOT EXISTS idx_incidents_style_no ON incidents(style_no)");
    db.run("CREATE INDEX IF NOT EXISTS idx_style_change_logs_line_id ON style_change_logs(line_id)");
    saveDatabase();
  } else {
    db = new SQL.Database();
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.run(schema);
    seedData();
    saveDatabase();
  }
  
  return db;
}

export function getDb() { return db; }

export function saveDatabase() {
  if (db) {
    const data = db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function seedData() {
  // 初始库存
  db.run("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES ('BE3250', 80, 80, 0)");
  db.run("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES ('BE2250', 5, 5, 0)");
  db.run("INSERT INTO inventory (style_no, current_stock, stock_t_minus_1, locked_for_today) VALUES ('BE3340', 250, 250, 0)");

  // 初始产线（带子产线示例）
  const line2SubLines = JSON.stringify([{ id: 'sub-2-1', name: '大管', currentStyle: 'BE3250', dailyCapacity: 30, exportCapacity: 15 }, { id: 'sub-2-2', name: 'SSP-1', currentStyle: 'BE2250', dailyCapacity: 15, exportCapacity: 8 }]);
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (1, 'Line 1', 'Running', 'BE3250', 50, 30)");
  db.run(`INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity, sub_lines) VALUES (2, 'Line 2', 'Running', '-', 45, 23, '${line2SubLines}')`);
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (3, 'Line 3', 'Running', 'BE2250', 40, 8)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (4, 'Line 4', 'Stopped', '-', 0, 0)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (5, 'Line 5', 'Running', 'BE3340', 60, 48)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (6, 'Line 6', 'Running', 'BE3340', 55, 38)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (7, 'Line 7', 'Maintenance', '-', 0, 0)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (8, 'Line 8', 'Running', 'BE3250', 40, 20)");
  db.run("INSERT INTO production_lines (id, name, status, current_style, daily_capacity, export_capacity) VALUES (9, 'Line 9', 'Running', 'BE2250', 35, 14)");

  // 初始订单
  db.run("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES ('1', '2023-11-29', 'BGF', 'BE3250', 'Z32025101631363', 1, '285753431', 123, 5, 30, 'Incheon', 'Wang Fujing', 'General Trade', '820KG Export Pack, Plywood Pallet, Film, Stock, Rail/Sea', 'Pending', 1, 1, 'Morning', '2023-11-29', 'Confirmed', 2)");
  db.run("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES ('2', '2023-11-29', 'BAIKSAN LINTEX', 'BE2250', '232025112232176', 3, '285753347', 22.96, 1, 28, 'Busan', 'Wang Fujing', 'General Trade', '820KG Export Pack, Plywood Pallet, Film, Stock, Premium', 'Confirmed', 0, 0, 'Afternoon', '2023-11-29', 'Confirmed', 0)");
  db.run("INSERT INTO orders (id, date, client, style_no, pi_no, line_id, bl_no, total_tons, containers, packages_per_container, port, contact_person, trade_type, requirements, status, is_large_order, large_order_ack, loading_time_slot, expected_ship_date, workshop_comm_status, prep_days_required) VALUES ('3', '2023-11-29', 'PT FILAMENDO', 'BE3340', 'Z32025093031198', 5, '177IKHKHS22941', 209.92, 8, 32, 'Jakarta', 'TRACY', 'Bonded', '820KG Export Pack, Molded Pallet, Film, Stock, Manual #614, Rail/Sea', 'Confirmed', 1, 0, 'Morning', '2023-11-30', 'InProgress', 3)");



  // 初始款号
  db.run("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES ('BE3250', '标准管材', 'A类', 820, '常规出口款')");
  db.run("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES ('BE2250', '小管材', 'B类', 820, '高端出口款')");
  db.run("INSERT INTO styles (style_no, name, category, unit_weight, note) VALUES ('BE3340', '大管材', 'A类', 820, '大批量出口款')");
  
  console.log('Database seeded with initial data');
}
