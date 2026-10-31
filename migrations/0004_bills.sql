-- Customer bills (additive only). A bill is the saved record behind the receipt; the money itself is still the
-- linked sale in `collections` (collection_client_id), so every report keeps working unchanged.
--  * series + bill_no: shared numbering. Series 'A' is handed out by the server (bill_counters); a phone that runs
--    out of reserved numbers while offline uses its own provisional series 'P<device>', which cannot collide.
--  * client_id: idempotency key, like every other synced table.

CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  series TEXT NOT NULL DEFAULT 'A',
  bill_no INTEGER NOT NULL,
  customer TEXT,
  phone TEXT,
  items_json TEXT NOT NULL DEFAULT '[]',
  subtotal_paise INTEGER NOT NULL DEFAULT 0,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL DEFAULT 0,
  pay_mode TEXT NOT NULL DEFAULT 'cash',
  collection_client_id TEXT,
  entry_date TEXT NOT NULL,
  voided INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, client_id),
  UNIQUE (company_id, series, bill_no)
);
CREATE INDEX idx_bills_company_date ON bills(company_id, entry_date);
CREATE INDEX idx_bills_company_phone ON bills(company_id, phone);

CREATE TABLE bill_counters (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  series TEXT NOT NULL,
  next_no INTEGER NOT NULL DEFAULT 1,     -- the next number nobody has been given yet
  PRIMARY KEY (company_id, series)
);

CREATE TRIGGER trg_bills_sync_i AFTER INSERT ON bills BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'bills', NEW.id, 'u'); END;
CREATE TRIGGER trg_bills_sync_u AFTER UPDATE ON bills BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'bills', NEW.id, 'u'); END;
CREATE TRIGGER trg_bills_sync_d AFTER DELETE ON bills BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'bills', OLD.id, 'd'); END;
