-- npx wrangler d1 execute DB --remote --file scripts/list-superadmins.sql
SELECT id, email, name, status, last_login_at FROM users WHERE role = 'super_admin' ORDER BY id;
