// Login rate limit: LOGIN_MAX_FAILS failed attempts per (IP + email) inside LOGIN_WINDOW_MIN minutes, then 429.
// A success clears the counter; once the window is over the next attempt starts a fresh one (never a permanent lock).
export const LOGIN_MAX_FAILS = 10;
export const LOGIN_WINDOW_MIN = 10;

export function loginKey(ip: string | undefined | null, email: string): string {
  return `${ip || 'unknown'}|${email.slice(0, 200)}`;
}

/** Seconds the caller must wait, or 0 if the attempt is allowed. */
export async function loginBlockedFor(db: D1Database, key: string): Promise<number> {
  const row = await db.prepare(
    `SELECT fails, CAST(strftime('%s', window_start, ?) AS INTEGER) - CAST(strftime('%s','now') AS INTEGER) AS left FROM login_attempts WHERE key = ?`,
  ).bind(`+${LOGIN_WINDOW_MIN} minutes`, key).first<{ fails: number; left: number }>();
  if (!row || row.fails < LOGIN_MAX_FAILS || row.left <= 0) return 0;
  return row.left;
}

export async function loginFailed(db: D1Database, key: string): Promise<void> {
  await db.prepare(
    `INSERT INTO login_attempts (key, fails, window_start) VALUES (?, 1, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       fails = CASE WHEN window_start <= datetime('now', ?) THEN 1 ELSE fails + 1 END,
       window_start = CASE WHEN window_start <= datetime('now', ?) THEN datetime('now') ELSE window_start END`,
  ).bind(key, `-${LOGIN_WINDOW_MIN} minutes`, `-${LOGIN_WINDOW_MIN} minutes`).run();
  // Housekeeping: drop stale rows now and then (cheap, bounded).
  if (Math.random() < 0.02) await db.prepare(`DELETE FROM login_attempts WHERE window_start < datetime('now', '-1 day')`).run();
}

export async function loginSucceeded(db: D1Database, key: string): Promise<void> {
  await db.prepare(`DELETE FROM login_attempts WHERE key = ?`).bind(key).run();
}
