-- Local-first sync support.
--  * client_id: a random id the phone generates for each new entry, so a retried upload can never create a duplicate
--  * notes: the smart notes calculator
--  * sync_log: every insert/update/delete per company (written by triggers in 0003) so a device can ask
--    "what changed since I last synced?" instead of re-downloading everything.

ALTER TABLE purchases ADD COLUMN client_id TEXT;
ALTER TABLE expenses ADD COLUMN client_id TEXT;
ALTER TABLE collections ADD COLUMN client_id TEXT;
ALTER TABLE payments ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX idx_purchases_client ON purchases(company_id, client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX idx_expenses_client ON expenses(company_id, client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX idx_collections_client ON collections(company_id, client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX idx_payments_client ON payments(company_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  entry_date TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, client_id)
);
CREATE INDEX idx_notes_company ON notes(company_id, updated_at);

CREATE TABLE sync_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  tbl TEXT NOT NULL,
  row_id INTEGER NOT NULL,
  op TEXT NOT NULL,                       -- 'u' = inserted or updated, 'd' = deleted
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sync_company_seq ON sync_log(company_id, seq);

CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT INTO sync_meta (key, value) VALUES ('pruned_through', 0);
