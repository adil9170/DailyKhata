import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync, statSync } from 'node:fs';

const css = readFileSync('public/css/app.css', 'utf8');
const sw = readFileSync('public/sw.js', 'utf8');

describe('landing font subsets', () => {
  it('each Lite face points at an existing, small file', () => {
    const urls = [...css.matchAll(/font-family: "(?:Palanquin|Eczar) Lite"[^}]*url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBe(4);
    for (const u of urls) expect(statSync('public' + u).size).toBeLessThan(30 * 1024);
  });
  it('landing uses the Lite families first and keeps the full ones as fallback', () => {
    const l = readFileSync('public/css/landing.css', 'utf8');
    expect(l).toMatch(/--font: "Palanquin Lite", "Palanquin"/);
    expect(l).toMatch(/--serif: "Eczar Lite", "Eczar"/);
  });
  it('Devanagari faces stay out of the service-worker precache', () => {
    const pre = sw.slice(sw.indexOf('PRECACHE'), sw.indexOf('self.addEventListener'));
    expect(pre).not.toMatch(/deva/);
  });
  it('the Palanquin Devanagari faces no longer claim the rupee sign (the font has no glyph for it)', () => {
    const lines = css.split('\n').filter((l: string) => /font-family: "Palanquin"/.test(l) && /deva/.test(l));
    expect(lines.length).toBe(2);
    for (const l of lines as string[]) expect(l).not.toMatch(/20B9/);
  });
});
