#!/usr/bin/env node
// Prints the `wrangler d1 execute` command that resets a super-admin password. Nothing is sent anywhere.
// Usage: node scripts/reset-superadmin.mjs <email> [--local|--remote]   (password is read from RESET_PASSWORD or prompted)
import { webcrypto as crypto } from 'node:crypto';
import readline from 'node:readline';

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();
const target = args.includes('--local') ? '--local' : args.includes('--remote') ? '--remote' : null;
if (!email || !/^\S+@\S+\.\S+$/.test(email) || !target) {
  console.error('Usage: node scripts/reset-superadmin.mjs <email> --local|--remote');
  console.error('List super-admins:  npx wrangler d1 execute DB --remote --command "SELECT email, name, status FROM users WHERE role = \'super_admin\'"');
  process.exit(1);
}

// Same scheme as src/lib/crypto.ts hashPassword: pbkdf2$100000$<salt b64>$<hash b64>
const ITER = 100_000;
const b64 = (u8) => Buffer.from(u8).toString('base64');
async function hash(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}
async function ask() {
  if (process.env.RESET_PASSWORD) return process.env.RESET_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((r) => rl.question('New password (8+ chars, letters and numbers): ', (a) => { rl.close(); r(a); }));
}

const pw = await ask();
if (pw.length < 8 || pw.length > 200 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { console.error('Password must be 8-200 chars with letters and numbers.'); process.exit(1); }
const h = await hash(pw);
const esc = (s) => s.replace(/'/g, "''");
const sql = `UPDATE users SET password_hash = '${h}', failed_logins = 0, locked_until = NULL, status = 'active' WHERE role = 'super_admin' AND email = '${esc(email)}'; DELETE FROM login_attempts; DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = '${esc(email)}');`;
console.log('Run this (it also clears lockouts and signs that user out everywhere):\n');
console.log(`npx wrangler d1 execute DB ${target} --command "${sql}"`);
