-- DailyKhata schema. All money values are stored as INTEGER paise (₹1 = 100).
-- Every business table carries company_id; every query in the Worker is scoped by it.

CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_products INTEGER NOT NULL DEFAULT 200,
  max_storage_mb INTEGER NOT NULL DEFAULT 500,
  ocr_enabled INTEGER NOT NULL DEFAULT 1,
  price_paise INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO plans (name, max_users, max_products, max_storage_mb, ocr_enabled, price_paise) VALUES
  ('Free', 3, 50, 100, 0, 0),
  ('Standard', 10, 500, 2000, 1, 49900),
  ('Business', 50, 5000, 20000, 1, 149900);

CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  plan_id INTEGER REFERENCES plans(id),
  logo_key TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0f766e',
  accent_color TEXT NOT NULL DEFAULT '#f59e0b',
  business_type TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','company_admin','manager','staff','viewer')),
  permissions TEXT,               -- JSON array; NULL = role defaults
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((role = 'super_admin' AND company_id IS NULL) OR (role <> 'super_admin' AND company_id IS NOT NULL))
);
CREATE INDEX idx_users_company ON users(company_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,            -- SHA-256 of the session token (raw token only lives in the cookie)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'box',          -- purchase unit label
  pieces_per_unit INTEGER NOT NULL DEFAULT 1,
  default_unit_cost_paise INTEGER,           -- cost of one purchase unit (box)
  sale_price_paise INTEGER,                  -- selling price per piece
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, name)
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('hisaab','bill','receipt','other')),
  entry_date TEXT,
  ocr_status TEXT NOT NULL DEFAULT 'none' CHECK (ocr_status IN ('none','processing','extracted','confirmed','failed')),
  ocr_result TEXT,
  ocr_error TEXT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_documents_company ON documents(company_id, created_at);

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty_units REAL NOT NULL,                   -- e.g. 2 (boxes)
  unit TEXT NOT NULL,
  pieces INTEGER NOT NULL,                   -- total pieces received
  total_cost_paise INTEGER NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','bank','credit')),
  supplier TEXT,
  notes TEXT,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_purchases_company_date ON purchases(company_id, entry_date);
CREATE INDEX idx_purchases_product ON purchases(company_id, product_id, entry_date);

CREATE TABLE expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  UNIQUE (company_id, name)
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  amount_paise INTEGER NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','bank','credit')),
  notes TEXT,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_expenses_company_date ON expenses(company_id, entry_date);

-- Sales collections. mode = cash/upi/card are money received; 'credit' = goods sold on udhaar (receivable).
CREATE TABLE collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cash' CHECK (mode IN ('cash','upi','card','credit')),
  customer TEXT,
  notes TEXT,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_collections_company_date ON collections(company_id, entry_date);

-- Settlements of outstanding amounts: paying suppliers for credit purchases, receiving udhaar from customers.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to_supplier','from_customer')),
  party TEXT,
  amount_paise INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cash' CHECK (mode IN ('cash','bank','upi')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_payments_company_date ON payments(company_id, entry_date);

-- End-of-day physical stock count, per product (pieces on hand at close).
CREATE TABLE stock_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  closing_pieces INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, entry_date, product_id)
);

-- End-of-day cash closing (counted cash in drawer) used to compute cash difference.
CREATE TABLE day_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  opening_cash_paise INTEGER,                -- NULL = carry forward previous counted cash
  counted_cash_paise INTEGER NOT NULL,
  notes TEXT,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, entry_date)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,                      -- create / update / delete / login / ...
  entity TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_company ON audit_logs(company_id, created_at);

CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
