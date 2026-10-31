import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, Env } from './types';
import auth from './routes/auth';
import company from './routes/company';
import admin from './routes/admin';
import { runScheduledBackups } from './lib/backup';
import { wwwRedirectTarget } from './lib/www';

const app = new Hono<AppEnv>();

// www.<domain> -> <domain> (301, keyed on the Host header). Only runs for requests that reach the Worker (all of /api/*);
// static pages are served by Workers Assets, so www pages redirect only once the owner adds the www hostname as a custom domain / redirect rule.
app.use('*', async (c, next) => {
  const to = wwwRedirectTarget(c.req.url, c.req.header('host'));
  if (to) return c.redirect(to, 301);
  await next();
});

// Security headers on every API response; never cache API data in shared caches.
app.use('/api/*', async (c, next) => {
  // CSRF: state-changing requests must come from this origin (cookies are also SameSite=Strict).
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    const self = new URL(c.req.url).origin;
    if (origin && origin !== self) return c.json({ error: 'Cross-site request blocked' }, 403);
    if (!origin && c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: 'Cross-site request blocked' }, 403);
  }
  await next();
  c.header('cache-control', c.res.headers.get('cache-control') ?? 'no-store');
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'same-origin');
  c.header('x-frame-options', 'DENY');
});

app.get('/api/health', (c) => c.json({ ok: true, app: c.env.APP_NAME }));
app.route('/api/auth', auth);
app.route('/api/c', company);
app.route('/api/admin', admin);
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  if (err instanceof SyntaxError) return c.json({ error: 'Invalid JSON body' }, 400);
  const msg = String((err as Error)?.message ?? err);
  if (/UNIQUE constraint failed/i.test(msg)) return c.json({ error: 'This record already exists' }, 409);
  if (/FOREIGN KEY constraint failed/i.test(msg)) return c.json({ error: 'This record is in use by other entries' }, 409);
  console.error(err);
  return c.json({ error: 'Something went wrong. Please try again.' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledBackups(env));
  },
} satisfies ExportedHandler<Env>;
