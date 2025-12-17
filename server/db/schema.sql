-- 库存表
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_no TEXT UNIQUE NOT NULL,
  current_stock REAL DEFAULT 0,
  grade_a REAL DEFAULT 0,
  grade_b REAL DEFAULT 0,
  stock_t_minus_1 REAL DEFAULT 0,
  locked_for_today REAL DEFAULT 0
);

-- 库存流水表
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_no TEXT NOT NULL,
  type TEXT NOT NULL,
  grade TEXT DEFAULT 'A',
  quantity REAL NOT NULL,
  balance REAL NOT NULL,
  source TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 款号表
CREATE TABLE IF NOT EXISTS styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_no TEXT UNIQUE NOT NULL,
  name TEXT,
  category TEXT,
  unit_weight REAL DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 产线表
CREATE TABLE IF NOT EXISTS production_lines (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'Running',
  current_style TEXT DEFAULT '-',
  daily_capacity REAL DEFAULT 0,
  export_capacity REAL DEFAULT 0,
  note TEXT,
  style_changed_at TEXT,
  sub_lines TEXT
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  client TEXT NOT NULL,
  style_no TEXT NOT NULL,
  pi_no TEXT,
  line_id INTEGER,
  bl_no TEXT,
  total_tons REAL NOT NULL,
  containers INTEGER DEFAULT 1,
  packages_per_container INTEGER DEFAULT 30,
  port TEXT,
  contact_person TEXT,
  trade_type TEXT DEFAULT 'General Trade',
  requirements TEXT,
  status TEXT DEFAULT 'Pending',
  is_large_order INTEGER DEFAULT 0,
  large_order_ack INTEGER DEFAULT 0,
  loading_time_slot TEXT DEFAULT 'Flexible',
  expected_ship_date TEXT,
  workshop_comm_status TEXT DEFAULT 'NotStarted',
  workshop_note TEXT,
  prep_days_required INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 异常日志表
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  style_no TEXT NOT NULL,
  order_client TEXT,
  reported_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  resolved INTEGER DEFAULT 0,
  resolved_at TEXT
);

-- 款号变更历史表
CREATE TABLE IF NOT EXISTS style_change_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL,
  from_style TEXT,
  to_style TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

-- 索引优化：提升查询性能
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_style_no ON orders(style_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_style_no ON inventory_transactions(style_no);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_style_no ON incidents(style_no);
CREATE INDEX IF NOT EXISTS idx_style_change_logs_line_id ON style_change_logs(line_id);
