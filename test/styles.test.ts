import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';
// @ts-expect-error plain JS module shared with the browser
import { STYLES } from '../public/js/styles.js';
// @ts-expect-error plain JS build script
import { THEMES, CELL_PAIRS, BADGE, contrast, mix, buildThemesCss } from '../scripts/themes.mjs';

const boot = readFileSync('public/boot.js', 'utf8');
const appCss = readFileSync('public/css/app.css', 'utf8');
type Style = { id: string; scheme: string; css: string; swatch: string[] };
type Theme = { id: string; t: Record<string, string>; css: string };

describe('Settings > Style', () => {
  it('boot.js knows every style (and its light/dark) so a saved style applies before first paint', () => {
    const m = boot.match(/var SS = (\{[^}]+\})/);
    expect(m).toBeTruthy();
    const ss = Function(`return ${m![1]}`)() as Record<string, string>;
    const expected = Object.fromEntries((STYLES as Style[]).filter((s) => s.id !== 'clean').map((s) => [s.id, s.scheme === 'any' ? '' : s.scheme]));
    expect(ss).toEqual(expected);
  });
  it('has the 19 art styles the owner asked for, plus Clean, Bento and the Collage mix', () => {
    const ids = (STYLES as Style[]).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(22);
    expect(ids).toContain('soft'); // Neumorphism keeps its old id, so people who picked "Soft" keep their look
  });
  it('every style has CSS in exactly one place', () => {
    const themed = new Set((THEMES as Theme[]).map((t) => t.id));
    for (const s of STYLES as Style[]) {
      expect(s.swatch, s.id).toHaveLength(4);
      if (s.css === 'themes') expect(themed.has(s.id), s.id).toBe(true);
      else { expect(themed.has(s.id), s.id).toBe(false); if (s.id !== 'clean') expect(appCss, s.id).toContain(`[data-style="${s.id}"]`); }
    }
    expect(themed.size).toBe((STYLES as Style[]).filter((s) => s.css === 'themes').length);
  });
  it('colours are readable: text, muted text, brand text and money colours reach 4.5:1', () => {
    const pairs = [['text', 'bg'], ['text', 'surface'], ['text', 'surface3'], ['text2', 'surface'], ['muted', 'surface'], ['muted', 'bg'], ['muted', 'surface3'],
      ['onBrand', 'brand'], ['brandFg', 'surface'], ['brandFg', 'bg'], ['good', 'surface'], ['bad', 'surface'], ['good', 'bg'], ['bad', 'bg']];
    for (const th of THEMES as Theme[]) for (const [a, b] of pairs) expect(contrast(th.t[a], th.t[b]), `${th.id} ${a} on ${b}`).toBeGreaterThanOrEqual(4.5);
    // badges: good / bad / warn text on its own light tint, over any surface
    for (const th of THEMES as Theme[]) for (const k of ['good', 'bad', 'warn']) for (const sf of ['bg', 'surface', 'surface2', 'surface3']) {
      const c = th.t[k] || '#8a5200';
      expect(contrast(c, mix(th.t[sf], c, BADGE)), `${th.id} ${k} badge on ${sf}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const [bg, fg] of CELL_PAIRS as string[][]) expect(contrast(fg, bg), `summary cell ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
  it('generated CSS only touches app pages (never the landing page) and has no stray placeholders', () => {
    const css = buildThemesCss() as string;
    expect(css).not.toContain('&');
    expect(css).not.toContain('undefined');
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("[^"]*"\)/g, '').split('}').map((r) => r.split('{')[0].trim())
      .filter((sel) => sel && !sel.startsWith('@') && !/^(from|to|\d+%)/.test(sel));
    for (const sel of selectors) for (const part of sel.split(',')) expect(part, part).toMatch(/html\.app-mode\[data-style="[a-z]+"\]/);
  });
});
