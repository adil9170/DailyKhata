-- Change-log triggers: every write to a synced table records (company, table, row, op) in sync_log automatically,
-- so no route can forget to log a change. Each trigger is a single statement.

CREATE TRIGGER trg_products_sync_i AFTER INSERT ON products BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'products', NEW.id, 'u'); END;
CREATE TRIGGER trg_products_sync_u AFTER UPDATE ON products BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'products', NEW.id, 'u'); END;
CREATE TRIGGER trg_products_sync_d AFTER DELETE ON products BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'products', OLD.id, 'd'); END;

CREATE TRIGGER trg_expense_categories_sync_i AFTER INSERT ON expense_categories BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'expense_categories', NEW.id, 'u'); END;
CREATE TRIGGER trg_expense_categories_sync_u AFTER UPDATE ON expense_categories BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'expense_categories', NEW.id, 'u'); END;
CREATE TRIGGER trg_expense_categories_sync_d AFTER DELETE ON expense_categories BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'expense_categories', OLD.id, 'd'); END;

CREATE TRIGGER trg_purchases_sync_i AFTER INSERT ON purchases BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'purchases', NEW.id, 'u'); END;
CREATE TRIGGER trg_purchases_sync_u AFTER UPDATE ON purchases BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'purchases', NEW.id, 'u'); END;
CREATE TRIGGER trg_purchases_sync_d AFTER DELETE ON purchases BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'purchases', OLD.id, 'd'); END;

CREATE TRIGGER trg_expenses_sync_i AFTER INSERT ON expenses BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'expenses', NEW.id, 'u'); END;
CREATE TRIGGER trg_expenses_sync_u AFTER UPDATE ON expenses BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'expenses', NEW.id, 'u'); END;
CREATE TRIGGER trg_expenses_sync_d AFTER DELETE ON expenses BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'expenses', OLD.id, 'd'); END;

CREATE TRIGGER trg_collections_sync_i AFTER INSERT ON collections BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'collections', NEW.id, 'u'); END;
CREATE TRIGGER trg_collections_sync_u AFTER UPDATE ON collections BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'collections', NEW.id, 'u'); END;
CREATE TRIGGER trg_collections_sync_d AFTER DELETE ON collections BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'collections', OLD.id, 'd'); END;

CREATE TRIGGER trg_payments_sync_i AFTER INSERT ON payments BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'payments', NEW.id, 'u'); END;
CREATE TRIGGER trg_payments_sync_u AFTER UPDATE ON payments BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'payments', NEW.id, 'u'); END;
CREATE TRIGGER trg_payments_sync_d AFTER DELETE ON payments BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'payments', OLD.id, 'd'); END;

CREATE TRIGGER trg_stock_counts_sync_i AFTER INSERT ON stock_counts BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'stock_counts', NEW.id, 'u'); END;
CREATE TRIGGER trg_stock_counts_sync_u AFTER UPDATE ON stock_counts BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'stock_counts', NEW.id, 'u'); END;
CREATE TRIGGER trg_stock_counts_sync_d AFTER DELETE ON stock_counts BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'stock_counts', OLD.id, 'd'); END;

CREATE TRIGGER trg_day_closings_sync_i AFTER INSERT ON day_closings BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'day_closings', NEW.id, 'u'); END;
CREATE TRIGGER trg_day_closings_sync_u AFTER UPDATE ON day_closings BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'day_closings', NEW.id, 'u'); END;
CREATE TRIGGER trg_day_closings_sync_d AFTER DELETE ON day_closings BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'day_closings', OLD.id, 'd'); END;

CREATE TRIGGER trg_notes_sync_i AFTER INSERT ON notes BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'notes', NEW.id, 'u'); END;
CREATE TRIGGER trg_notes_sync_u AFTER UPDATE ON notes BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (NEW.company_id, 'notes', NEW.id, 'u'); END;
CREATE TRIGGER trg_notes_sync_d AFTER DELETE ON notes BEGIN INSERT INTO sync_log (company_id, tbl, row_id, op) VALUES (OLD.company_id, 'notes', OLD.id, 'd'); END;
