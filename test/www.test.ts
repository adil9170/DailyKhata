import { describe, it, expect } from 'vitest';
import { wwwRedirectTarget as r } from '../src/lib/www';
// @ts-expect-error plain JS module
import { EN, HI } from '../public/js/landing-i18n.js';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';
// @ts-expect-error plain JS module
import { buildHindi, jsonLd, faqLd } from '../scripts/seo.mjs';

describe('www redirect', () => {
  it('redirects www to the apex, keeping path and query, forcing https', () => {
    expect(r('https://www.jakcrew.com/')).toBe('https://jakcrew.com/');
    expect(r('http://www.jakcrew.com/api/health?x=1&y=2')).toBe('https://jakcrew.com/api/health?x=1&y=2');
    expect(r('https://x.workers.dev/a', 'WWW.JakCrew.com:443')).toBe('https://jakcrew.com/a');
  });
  it('leaves the apex, workers.dev, localhost and odd hosts alone', () => {
    expect(r('https://jakcrew.com/')).toBeNull();
    expect(r('https://dailykhata.adilshaikh.in.workers.dev/')).toBeNull();
    expect(r('http://localhost:8788/api/health')).toBeNull();
    expect(r('http://www.localhost:8788/')).toBeNull();
    expect(r('https://www.com/')).toBeNull();
    expect(r('not a url')).toBeNull();
  });
});

const html = readFileSync('public/index.html', 'utf8');
const faqText = (h: string, d: Record<string, string>) => [0, 1, 2, 3, 4].map((i) => [d['q' + i], d['a' + i]]);
const ld = (h: string) => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);

describe('landing SEO', () => {
  it('English JSON-LD in index.html is current and the FAQ matches the visible FAQ', () => {
    expect(html).toContain(jsonLd(EN, 'en', 'https://jakcrew.com/').replace(/\n/g, '\n  '));
    const visible = [...html.matchAll(/<summary[^>]*>([^<]*)<\/summary><p[^>]*>([^<]*)<\/p>/g)].map((m) => [m[1], m[2]]);
    expect(visible).toEqual(faqText(html, EN));
  });
  it('has absolute og:image, twitter card and hreflang pair', () => {
    expect(html).toContain('<meta property="og:image" content="https://jakcrew.com/og.png">');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('hreflang="hi" href="https://jakcrew.com/hi/"');
    expect(html).not.toMatch(/aggregateRating|ratingValue|"offers"/);
  });
  const hi = buildHindi(html, HI, EN);
  it('Hindi page: lang, title, canonical, hreflang both ways, JSON-LD FAQ equals visible Hindi FAQ', () => {
    expect(hi).toContain('<html lang="hi">');
    expect(hi).toContain(`<title data-i18n="title">${HI.title}</title>`);
    expect(hi).toContain('<link rel="canonical" href="https://jakcrew.com/hi/">');
    expect(hi.match(/hreflang="en" href="https:\/\/jakcrew\.com\/"/g)).toHaveLength(1);
    expect(hi.match(/hreflang="hi" href="https:\/\/jakcrew\.com\/hi\/"/g)).toHaveLength(1);
    const visible = [...hi.matchAll(/<summary[^>]*>([^<]*)<\/summary><p[^>]*>([^<]*)<\/p>/g)].map((m) => [m[1], m[2]]);
    expect(visible).toEqual(faqText(hi, HI));
    expect(ld(hi)['@graph'][1]).toEqual(faqLd(HI));
  });
  it('Hindi page carries the Hindi text of every data-i18n element', () => {
    for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) {
      const esc = HI[m[1]].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      expect(hi, m[1]).toContain(esc);
    }
  });
  it('og.png is under 150 KB and 1200x630', () => {
    const b = readFileSync('public/og.png');
    expect(b.length).toBeLessThan(150 * 1024);
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
