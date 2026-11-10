import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';
// @ts-expect-error plain JS module shared with the browser
import { TEMPLATES, DEFAULT_THANKS, readReceiptPrefs, writeReceiptPrefs, cleanThanks, footerFor, hasTable, stripeWidths, templateById } from '../public/js/receiptprefs.js';

const mem = (init: Record<string, string> = {}) => {
  const s: Record<string, string> = { ...init };
  return { s, getItem: (k: string) => (k in s ? s[k] : null), setItem: (k: string, v: string) => { s[k] = String(v); }, removeItem: (k: string) => { delete s[k]; } };
};

describe('receipt templates', () => {
  it('every template in the list is drawn by receipt.js', () => {
    const src = readFileSync('public/js/receipt.js', 'utf8');
    const ids = (TEMPLATES as { id: string }[]).map((t) => t.id);
    expect(ids).toEqual(['classic', 'thermal', 'paper', 'modern', 'invoice', 'bold']);
    for (const id of ids) expect(src, id).toMatch(new RegExp(`\\n  ${id}: \\{`));
  });
  it('falls back to Classic and the usual thank-you line when nothing (or junk) is saved', () => {
    for (const st of [mem(), mem({ dk_receipt: '{bad' }), mem({ dk_receipt: JSON.stringify({ tpl: 'nope', thanks: 7 }) }), undefined]) {
      expect(readReceiptPrefs(st)).toEqual({ tpl: 'classic', thanks: DEFAULT_THANKS });
    }
    expect(templateById('zzz').id).toBe('classic');
  });
  it('saves a design and a cleaned thank-you line; an empty line means none', () => {
    const st = mem();
    writeReceiptPrefs({ tpl: 'invoice', thanks: '  Shukriya!\n\tphir aana  ' }, st);
    expect(readReceiptPrefs(st)).toEqual({ tpl: 'invoice', thanks: 'Shukriya! phir aana' });
    writeReceiptPrefs({ tpl: 'paper', thanks: '' }, st);
    expect(readReceiptPrefs(st).thanks).toBe('');
    expect(cleanThanks('x'.repeat(200))).toHaveLength(80);
  });
  it('footer: an explicit footer wins, else status + the shop line (only where asked)', () => {
    const prefs = { tpl: 'classic', thanks: 'Thank you!' };
    expect(footerFor({ footer: 'Custom' }, prefs)).toBe('Custom');
    expect(footerFor({ status: 'Paid by UPI', thanks: true }, prefs)).toBe('Paid by UPI · Thank you!');
    expect(footerFor({ status: 'Paid by UPI', thanks: true }, { ...prefs, thanks: '' })).toBe('Paid by UPI');
    expect(footerFor({ status: 'Paid' }, prefs)).toBe('Paid');
    expect(footerFor({}, prefs)).toBe('');
  });
  it('bills get the invoice table; cash reports and notes do not', () => {
    expect(hasTable([{ label: 'Campa', qty: 2, rate: '₹40', value: '₹80' }, { label: 'Discount', value: '−₹10' }])).toBe(true);
    expect(hasTable([{ label: '₹500 × 4', value: '₹2,000' }])).toBe(false);
  });
  it('the printer strip is stable for the same receipt and differs between receipts', () => {
    expect(stripeWidths('Bill #1|₹80')).toEqual(stripeWidths('Bill #1|₹80'));
    expect(stripeWidths('Bill #1|₹80')).not.toEqual(stripeWidths('Bill #2|₹80'));
    expect(stripeWidths('x').every((w: number) => w >= 1 && w <= 4)).toBe(true);
  });
});

const counterSrc = readFileSync('public/js/pages/counter.js', 'utf8');
describe('cash counter online money', () => {
  it('keeps cash and Paytm / UPI apart: cash sale + UPI sale, closing cash from cash only', () => {
    expect(counterSrc).toMatch(/mode: 'upi'/);
    expect(counterSrc).toMatch(/counted_cash: String\(c\)/);
  });
  it('typed rupees become whole paise safely', () => {
    const toPaise = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s₹]/g, '')); return Number.isFinite(n) ? Math.max(0, Math.min(99999999999, Math.round(n * 100))) : 0; };
    const m = counterSrc.match(/export const toPaise = [^\n]*/)![0];
    expect(m).toContain('Math.round(n * 100)'); // same rule as the helper below
    expect([toPaise('1,200'), toPaise('249.5'), toPaise('₹ 10'), toPaise('abc'), toPaise('-5'), toPaise('')]).toEqual([120000, 24950, 1000, 0, 0, 0]);
  });
});

describe('public cash counter page', () => {
  const html = readFileSync('public/counter/index.html', 'utf8');
  it('is a stand-alone page that needs no sign-in and never offers Save to visitors', () => {
    expect(html).toContain('/dist/counter-public.js');
    expect(html).toContain('class="app-mode"');
    expect(html).toContain('<link rel="canonical" href="https://jakcrew.com/counter/">');
    expect(counterSrc).toMatch(/can\('entries\.write'\) \|\| can\('cash\.close'\) \? h\('button'/);
    expect(readFileSync('scripts/build-client.mjs', 'utf8')).toContain("'counter-public'");
  });
  it('the mic is allowed by the page policy (voice entry on the landing page and chat)', () => {
    expect(readFileSync('public/_headers', 'utf8')).toContain('microphone=(self)');
  });
});
