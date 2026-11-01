import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';

const pub = (p: string): any => readFileSync('public/' + p);
const size = (buf: any) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

describe('app icons', () => {
  const manifest = JSON.parse(pub('manifest.webmanifest').toString());
  it('manifest lists real PNG icons at 192, 512 and a maskable 512', () => {
    const png = manifest.icons.filter((i: any) => i.type === 'image/png');
    expect(png.map((i: any) => i.sizes + ':' + i.purpose).sort()).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    for (const i of png) {
      const buf = pub(i.src.slice(1));
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      const { w, h } = size(buf);
      expect(`${w}x${h}`).toBe(i.sizes);
    }
  });
  it('apple-touch-icon is a 180px PNG and linked from index.html', () => {
    expect(size(pub('icons/apple-touch-icon.png'))).toEqual({ w: 180, h: 180 });
    expect(pub('index.html').toString()).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
  });
  it('mark green matches the shared palette and the theme colour', () => {
    expect(pub('favicon.svg').toString()).toContain('#2e6f4f');
    expect(pub('logo.svg').toString()).toContain('#2e6f4f');
    expect(manifest.theme_color).toBe('#2e6f4f');
    expect(pub('css/app.css').toString()).toContain('--green: #2e6f4f');
  });
  it('service worker precaches the home-screen icons', () => {
    const sw = pub('sw.js').toString();
    expect(sw).toContain('/icons/apple-touch-icon.png');
    expect(sw).toContain('/icons/icon-192.png');
  });
});
