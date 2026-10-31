import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';
// @ts-expect-error plain JS module shared with the browser
import { EN, HI, getLang } from '../public/js/landing-i18n.js';

const html = readFileSync('public/index.html', 'utf8');
const js = readFileSync('public/js/landing.js', 'utf8');
const used = new Set<string>();
for (const m of html.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) used.add(m[1]);
// keys passed to t() (also inside ternaries): any quoted literal in landing.js that names a dictionary key
for (const m of js.matchAll(/'([a-z][a-z0-9]*_[a-z0-9_]+)'/g)) if (m[1] in EN) used.add(m[1]);

for (const m of js.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]); // a typo'd key in t() fails the existence test below

describe('landing i18n', () => {
  it('finds the keys the page uses', () => { expect(used.size).toBeGreaterThan(60); });
  it('every key used in index.html / landing.js exists, non-empty, in both languages', () => {
    for (const k of used) {
      expect(EN[k], `EN.${k}`).toBeTruthy();
      expect(HI[k], `HI.${k}`).toBeTruthy();
    }
  });
  it('both dictionaries have exactly the same keys, and no key is unused', () => {
    expect(Object.keys(HI).sort()).toEqual(Object.keys(EN).sort());
    for (const k of Object.keys(EN)) expect(used.has(k), `unused ${k}`).toBe(true);
  });
  it('placeholders match between languages', () => {
    for (const k of Object.keys(EN)) expect([...(HI[k].match(/\{\w+\}/g) || [])].sort(), k).toEqual([...(EN[k].match(/\{\w+\}/g) || [])].sort());
  });
  it('English text in the dictionary equals the shipped HTML text (no drift)', () => {
    for (const m of html.matchAll(/<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>([^<]*)</g)) {
      if (['title', 'h1b', 'fin_h1', 'fin_h2', 'try_hi'].includes(m[2])) continue; // Hindi in both
      expect(m[3].replace(/\s+/g, ' ').trim(), m[2]).toBe(EN[m[2]].replace(/\s+/g, ' ').trim());
    }
  });
  it('defaults: English, Hindi for hi browsers, saved choice wins', () => {
    const g = globalThis as any;
    const keep = [g.navigator, g.localStorage];
    const set = (nav: string, saved: string | null) => {
      Object.defineProperty(g, 'navigator', { value: { language: nav }, configurable: true });
      Object.defineProperty(g, 'localStorage', { value: { getItem: () => saved }, configurable: true });
    };
    try {
      set('en-IN', null); expect(getLang()).toBe('en');
      set('hi-IN', null); expect(getLang()).toBe('hi');
      set('hi', 'en'); expect(getLang()).toBe('en');
      set('en-US', 'hi'); expect(getLang()).toBe('hi');
      set('hi', 'garbage'); expect(getLang()).toBe('hi');
    } finally {
      Object.defineProperty(g, 'navigator', { value: keep[0], configurable: true });
      Object.defineProperty(g, 'localStorage', { value: keep[1], configurable: true });
    }
  });
});
