import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';

const html = readFileSync('public/bento/index.html', 'utf8');
const js = readFileSync('public/js/bento.js', 'utf8');
const css = readFileSync('public/css/bento.css', 'utf8');

describe('bento landing page', () => {
  it('is an alternate page: noindex, canonical to the main page', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex">/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/jakcrew\.com\/">/);
  });
  it('keeps the credit link to adilshaikh.in as a normal (do-follow) link', () => {
    const m = html.match(/<a [^>]*href="https:\/\/adilshaikh\.in"[^>]*>Adil Shaikh<\/a>/);
    expect(m).toBeTruthy();
    expect(m![0]).not.toMatch(/nofollow/);
  });
  it('every element id the script uses exists in the page', () => {
    const used = new Set([...js.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(8);
    for (const id of used) expect(html, `missing id ${id}`).toContain(`id="${id}"`);
  });
  it('loads its own stylesheet and script, and the CSS defines the fonts it uses', () => {
    expect(html).toContain('/css/bento.css');
    expect(html).toContain('/dist/bento.js');
    expect(css).toMatch(/@font-face[^}]*Eczar/);
    expect(css).toMatch(/@font-face[^}]*Palanquin/);
  });
  it('is built as a second bundle entry', () => {
    expect(readFileSync('scripts/build-client.mjs', 'utf8')).toMatch(/bento: 'public\/js\/bento\.js'/);
  });
});
