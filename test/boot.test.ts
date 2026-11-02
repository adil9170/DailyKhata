import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';

const code = readFileSync('public/boot.js', 'utf8');

/** Runs public/boot.js against a tiny stand-in for the browser and returns what it did. */
function boot(saved: Record<string, string>, hash = '') {
  const store: Record<string, string> = { ...saved };
  const ls = {
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const attrs: Record<string, string> = {}; const classes = new Set<string>(); const written: string[] = [];
  const d = { setAttribute: (k: string, v: string) => { attrs[k] = v; }, classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) }, lang: 'en' };
  const doc = { documentElement: d, write: (h: string) => written.push(h) };
  const mm = () => ({ matches: false });
  Function('document', 'localStorage', 'location', 'navigator', 'window', 'matchMedia', 'setTimeout', code)(
    doc, ls, { hash, pathname: '/' }, { language: 'en-IN', deviceMemory: 8, hardwareConcurrency: 8 }, { matchMedia: mm }, mm, () => 0);
  return { store, attrs, classes, written };
}

describe('boot.js picks the look before first paint', () => {
  it('a brand-new device starts on Paper & ink, without loading the style sheet on the landing page', () => {
    const r = boot({});
    expect(r.store.dk_style).toBe('landing');
    expect(r.attrs['data-style']).toBe('landing');
    expect(r.classes.has('app-mode')).toBe(false);
    expect(r.written).toEqual([]);
  });
  it('a new device opening an app link gets the Paper & ink sheet and keeps following Light/Dark', () => {
    const r = boot({}, '#/login');
    expect(r.written.join('')).toContain('/css/themes.css');
    expect(r.attrs['data-theme']).toBeUndefined();
  });
  it('a device that already used the app keeps Clean, saved so it never flips', () => {
    const devices: Record<string, string>[] = [{ dk_session: JSON.stringify({ user: { id: 1 } }) }, { dk_start_done: '1' }, { dk_mode_7: 'smart' }, { dk_theme: 'dark' }];
    for (const saved of devices) {
      const r = boot(saved);
      expect(r.store.dk_style, JSON.stringify(saved)).toBe('clean');
      expect(r.attrs['data-style']).toBeUndefined();
      expect(r.written).toEqual([]);
    }
  });
  it('only a landing-page language choice does not count as having used the app', () => {
    expect(boot({ dk_lang: 'hi' }).store.dk_style).toBe('landing');
  });
  it('a saved art style applies in the app with its own scheme; unknown values are ignored', () => {
    const r = boot({ dk_style: 'vapor', dk_session: JSON.stringify({ user: { id: 1 } }) });
    expect(r.attrs['data-style']).toBe('vapor');
    expect(r.attrs['data-theme']).toBe('dark');
    expect(r.written.join('')).toContain('/css/themes.css');
    const x = boot({ dk_style: 'nope', dk_session: JSON.stringify({ user: { id: 1 } }) });
    expect(x.attrs['data-style']).toBeUndefined();
    expect(x.written).toEqual([]);
    expect(boot({ dk_style: 'clean', dk_session: JSON.stringify({ user: { id: 1 } }) }).attrs['data-style']).toBeUndefined();
  });
});
