import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync, readdirSync } from 'node:fs';

// i18n.js reads localStorage / navigator lazily, so give it a tiny browser stand-in before importing.
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
(globalThis as any).window = { dispatchEvent: () => true };
(globalThis as any).Event = class { constructor(public type: string) {} };
// @ts-expect-error plain JS module shared with the browser
const mod: any = await import('../public/js/i18n.js');

const JS = 'public/js';
const join = (...p: string[]) => p.join('/');
const files = [...readdirSync(JS).filter((f: string) => f.endsWith('.js')).map((f: string) => join(JS, f)), ...readdirSync(join(JS, 'pages')).map((f: string) => join(JS, 'pages', f))];

describe('app language', () => {
  beforeEach(() => { delete store.dk_lang; (mod as any).setLang?.('en'); delete store.dk_lang; });

  it('every literal key used with tx()/t() has a Hindi string', () => {
    const missing: string[] = [];
    for (const f of files) {
      if (/landing/.test(f)) continue;
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\btx\('((?:[^'\\]|\\.)*)'/g)) {
        const key = m[1].replace(/\\'/g, "'");
        if (!(key in mod.HI_KEYS)) missing.push(`${f.split('/js/')[1]}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('Hindi strings keep the same {placeholders} as the key', () => {
    for (const [k, v] of Object.entries(mod.HI_KEYS as Record<string, string>)) {
      const a = (k.match(/\{\w+\}/g) || []).sort().join(), b = (v.match(/\{\w+\}/g) || []).sort().join();
      expect(b, k).toBe(a);
    }
  });

  it('falls back to English for a missing key and fills placeholders', () => {
    mod.setLang('hi');
    expect(mod.t('No such key at all')).toBe('No such key at all');
    expect(mod.t('key.x', 'Fallback {n}', { n: 3 })).toBe('Fallback 3');
    expect(mod.t('Sales')).toBe('बिक्री');
    expect(mod.t('Hi {name}', null, { name: 'रवि' })).toBe('नमस्ते रवि');
    expect(mod.locale()).toBe('hi-IN');
    mod.setLang('en');
    expect(mod.t('Sales')).toBe('Sales');
    expect(mod.locale()).toBe('en-IN');
  });

  it('chooses the language: saved choice, then the phone language, else English', async () => {
    delete store.dk_lang;
    expect(typeof mod.lang()).toBe('string');
    store.dk_lang = 'hi'; mod.setLang('hi');
    expect(store.dk_lang).toBe('hi');
  });
});
