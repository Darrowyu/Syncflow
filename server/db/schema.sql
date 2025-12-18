-- 库存表 (按款号+仓库类型+包装规格唯一)
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_no TEXT NOT NULL,
  warehouse_type TEXT DEFAULT 'general',
  package_spec TEXT DEFAULT '820kg',
  current_stock REAL DEFAULT 0,
  grade_a REAL DEFAULT 0,
  grade_b REAL DEFAULT 0,
  stock_t_minus_1 REAL DEFAULT 0,
  locked_for_today REAL DEFAULT 0,
  safety_stock REAL DEFAULT 0,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(style_no, warehouse_type, package_spec)
);

-- 库存盘点审计日志表
CREATE TABLE IF NOT EXISTS inventory_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_no TEXT NOT NULL,
  warehouse_type TEXT DEFAULT 'general',
  package_spec TEXT DEFAULT '820kg',
  action TEXT NOT NULL,
  before_grade_a REAL DEFAULT 0,
  before_grade_b REAL DEFAULT 0,
  after_grade_a REAL DEFAULT 0,
  after_grade_b REAL DEFAULT 0,
  reason TEXT,
  operator TEXT DEFAULT 'system',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 库存流水表
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  style_no TEXT NOT NULL,
  warehouse_type TEXT DEFAULT 'general',
  package_spec TEXT DEFAULT '820kg',
  type TEXT NOT NULL,
  grade TEXT DEFAULT 'A',
  quantity REAL NOT NULL,
  balance REAL NOT NULL,
  source TEXT,
  note TEXT,
  order_id TEXT,
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
  package_spec TEXT,
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
  warehouse_allocation TEXT,
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
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_id ON inventory_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_style_no ON inventory_audit_logs(style_no);
CREATE INDEX IF NOT EXISTS idx_inventory_safety_stock ON inventory(safety_stock);
CREATE INDEX IF NOT EXISTS idx_incidents_style_no ON incidents(style_no);
CREATE INDEX IF NOT EXISTS idx_style_change_logs_line_id ON style_change_logs(line_id);

-- 客户表
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client);
