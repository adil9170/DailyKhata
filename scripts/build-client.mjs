// Bundles the browser app (public/js) into public/dist: one small entry file plus code-split page chunks.
// Why: unbundled ES modules load as a chain of requests (each waits for its parent), which is slow on mobile data.
// Runs automatically before `wrangler dev` / `wrangler deploy` (see [build] in wrangler.toml); output is git-ignored.
import { build } from 'esbuild';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
rmSync(`${root}public/dist`, { recursive: true, force: true });
mkdirSync(`${root}public/dist`, { recursive: true });

const result = await build({
  absWorkingDir: root,
  entryPoints: { app: 'public/js/app.js' },
  outdir: 'public/dist',
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2019',          // lowers ?. ?? ??= for older Android WebViews
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
});

const files = Object.keys(result.metafile.outputs).filter((f) => !f.endsWith('.map')).map((f) => '/' + f.replace(/^public\//, ''));
const hash = createHash('sha1').update(files.map((f) => readFileSync(root + 'public' + f)).join('')).digest('hex').slice(0, 10);
writeFileSync(`${root}public/dist/manifest.json`, JSON.stringify({ version: hash, files }));
const kb = (f) => (readFileSync(root + 'public' + f).length / 1024).toFixed(1);
console.log(`client bundle ${hash}: ${files.map((f) => `${f.replace('/dist/', '')} ${kb(f)}KB`).join(', ')}`);
