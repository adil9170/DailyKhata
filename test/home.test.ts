import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module shared with the browser
import { LAYOUTS, SECTIONS, SHORTCUTS, readHome, writeHome, homeParts, homePage, move, merged } from '../public/js/home.js';

const mem = (init: Record<string, string> = {}) => {
  const s: Record<string, string> = { ...init };
  return { s, getItem: (k: string) => (k in s ? s[k] : null), setItem: (k: string, v: string) => { s[k] = String(v); }, removeItem: (k: string) => { delete s[k]; } };
};
type Part = { id: string; on: boolean };

describe('home screen settings', () => {
  it('defaults to Quick add with the usual sections when nothing is saved (or storage is broken)', () => {
    for (const st of [mem(), mem({ dk_home: '{not json' }), mem({ dk_home: JSON.stringify({ layout: 'nope' }) }), undefined]) {
      const h = readHome(st);
      expect(h.layout).toBe('quick');
      expect(homePage(h)).toBe('quick');
      expect(homeParts(h).sections.filter((x: Part) => x.on).map((x: Part) => x.id)).toEqual(['greeting', 'totals', 'add', 'shortcuts', 'recent']);
    }
  });
  it('keeps people who chose Chat before (old dk_layout key) on Chat', () => {
    expect(readHome(mem({ dk_layout: 'chat' })).layout).toBe('chat');
    expect(homePage(readHome(mem({ dk_layout: 'chat' })))).toBe('chat');
  });
  it('every layout opens a real page and quick layouts have their own defaults', () => {
    for (const l of LAYOUTS as { id: string; page: string }[]) {
      expect(['quick', 'day', 'chat']).toContain(l.page);
      const p = homeParts({ layout: l.id, per: {} });
      expect(p.sections).toHaveLength(SECTIONS.length);
      expect(p.shortcuts).toHaveLength(SHORTCUTS.length);
    }
    expect(homeParts({ layout: 'grid', per: {} }).shortcuts.filter((x: Part) => x.on)[0].id).toBe('sale');
    expect(homeParts({ layout: 'minimal', per: {} }).sections.filter((x: Part) => x.on).map((x: Part) => x.id)).toContain('bigadd');
  });
  it('saved choices win; unknown or repeated ids are dropped; new parts are added switched off', () => {
    const saved = [{ id: 'recent', on: true }, { id: 'bogus', on: true }, { id: 'recent', on: false }, { id: 'greeting', on: false }];
    const out = merged(SECTIONS, saved, ['greeting', 'totals']);
    expect(out[0]).toEqual({ id: 'recent', on: true });
    expect(out[1]).toEqual({ id: 'greeting', on: false });
    expect(out.map((x: Part) => x.id).sort()).toEqual(SECTIONS.map((x: { id: string }) => x.id).sort());
    expect(out.slice(2).every((x: Part) => !x.on)).toBe(true);
  });
  it('moving stays inside the list', () => {
    expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(move(['a', 'b', 'c'], 2, -2)).toEqual(['c', 'b', 'a']);
  });
  it('writes the layout and keeps the old Chat key in step', () => {
    const st = mem();
    writeHome({ layout: 'chat', per: {} }, st);
    expect(st.s.dk_layout).toBe('chat');
    writeHome({ layout: 'grid', per: { grid: { sections: [{ id: 'totals', on: true }] } } }, st);
    expect(st.s.dk_layout).toBeUndefined();
    const back = readHome(st);
    expect(back.layout).toBe('grid');
    expect(homeParts(back).sections[0]).toEqual({ id: 'totals', on: true });
  });
});
