-- Login rate limit (additive only): failed attempts per IP + email, counted in a 10 minute window.
-- Rows expire by themselves (a new window starts once the old one is over), so nobody is locked out for good.
CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);
