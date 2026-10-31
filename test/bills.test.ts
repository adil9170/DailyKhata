import { describe, it, expect } from 'vitest';
import { normalizeBill, cleanPhone, billLabel, reserveCount, MAX_BILL_ITEMS } from '../src/lib/bills';

const T = '2026-10-31';
const base = { items: [{ name: 'Sting', qty: 2, rate: '20' }], pay_mode: 'cash' };
const err = (f: () => unknown) => { try { f(); } catch (e: any) { return String(e.message); } return ''; };

describe('normalizeBill', () => {
  it('computes paise totals and defaults', () => {
    const r = normalizeBill({ ...base, discount: '5' }, T);
    expect(r).toMatchObject({ series: 'A', bill_no: null, subtotal_paise: 4000, discount_paise: 500, total_paise: 3500, pay_mode: 'cash', entry_date: T, customer: null, phone: null });
    expect(JSON.parse(r.items_json)).toEqual([{ name: 'Sting', qty: 2, rate_paise: 2000, amount_paise: 4000 }]);
  });
  it('discount larger than subtotal clamps the total to zero', () => {
    expect(normalizeBill({ ...base, discount: 999 }, T).total_paise).toBe(0);
  });
  it('rejects empty, too many, and malformed items', () => {
    expect(err(() => normalizeBill({ items: [] }, T))).toMatch(/at least one/);
    expect(err(() => normalizeBill(null, T))).toMatch(/Invalid bill/);
    expect(err(() => normalizeBill({ items: Array(MAX_BILL_ITEMS + 1).fill(base.items[0]) }, T))).toMatch(/at most 100/);
    expect(normalizeBill({ items: Array(MAX_BILL_ITEMS).fill(base.items[0]) }, T).subtotal_paise).toBe(400000);
    expect(err(() => normalizeBill({ items: [{ name: '', qty: 1, rate: 1 }] }, T))).toMatch(/name/);
    expect(err(() => normalizeBill({ items: [{ name: 'x', qty: 0, rate: 1 }] }, T))).toMatch(/Quantity/);
    expect(err(() => normalizeBill({ items: [{ name: 'x', qty: 'abc', rate: 1 }] }, T))).toMatch(/Quantity/);
    expect(err(() => normalizeBill({ items: [{ name: 'x', qty: 1, rate: -5 }] }, T))).toMatch(/negative/);
    expect(err(() => normalizeBill({ items: [{ name: 'x'.repeat(81), qty: 1, rate: 1 }] }, T))).toMatch(/too long/);
    expect(err(() => normalizeBill({ items: [{ name: 'x', qty: 1e6, rate: 1e8 }] }, T))).toMatch(/too large/);
  });
  it('udhaar needs a customer; bad mode/date/series/number are rejected', () => {
    expect(err(() => normalizeBill({ ...base, pay_mode: 'credit' }, T))).toMatch(/Udhaar/);
    expect(normalizeBill({ ...base, pay_mode: 'credit', customer: 'Mehta' }, T).pay_mode).toBe('credit');
    expect(err(() => normalizeBill({ ...base, pay_mode: 'cheque' }, T))).toMatch(/payment mode/);
    expect(err(() => normalizeBill({ ...base, date: '2026-13-40' }, T))).toBeTruthy();
    expect(err(() => normalizeBill({ ...base, series: 'a b' }, T))).toMatch(/series/);
    expect(err(() => normalizeBill({ ...base, bill_no: 0 }, T))).toMatch(/number/);
    expect(err(() => normalizeBill({ ...base, bill_no: 1.5 }, T))).toMatch(/number/);
    expect(normalizeBill({ ...base, series: 'PK7Q2', bill_no: '12' }, T)).toMatchObject({ series: 'PK7Q2', bill_no: 12 });
  });
  it('keeps Hindi and odd characters in names', () => {
    const r = normalizeBill({ items: [{ name: 'चाय 🍵', qty: 1.5, rate: '12.50' }], customer: "राम's <b>store</b>" }, T);
    expect(r.customer).toBe("राम's <b>store</b>");
    expect(JSON.parse(r.items_json)[0]).toMatchObject({ name: 'चाय 🍵', qty: 1.5, amount_paise: 1875 });
  });
});

describe('cleanPhone', () => {
  it('normalises Indian numbers', () => {
    expect(cleanPhone('98765 43210')).toBe('+919876543210');
    expect(cleanPhone('+91 98765-43210')).toBe('+919876543210');
    expect(cleanPhone('09876543210')).toBe('+919876543210');
    expect(cleanPhone('919876543210')).toBe('+919876543210');
    expect(cleanPhone('+14155550123')).toBe('+14155550123');
  });
  it('empty is null, junk throws', () => {
    expect(cleanPhone('')).toBeNull(); expect(cleanPhone(undefined)).toBeNull(); expect(cleanPhone('---')).toBeNull();
    expect(err(() => cleanPhone('123'))).toMatch(/wrong/);
    expect(err(() => cleanPhone('1'.repeat(20)))).toMatch(/wrong/);
    expect(err(() => cleanPhone(12345678 as any))).toMatch(/Invalid/);
  });
});

describe('numbering helpers', () => {
  it('labels', () => { expect(billLabel('A', 7)).toBe('7'); expect(billLabel('PK7Q2', 3)).toBe('PK7Q2-3'); });
  it('reserve count is clamped to 1..100', () => {
    expect(reserveCount(undefined)).toBe(1); expect(reserveCount(20)).toBe(20); expect(reserveCount(5000)).toBe(100);
    expect(err(() => reserveCount(0))).toMatch(/at least 1/); expect(err(() => reserveCount('x'))).toMatch(/at least 1/);
  });
});

import { waNumber, reminderText, billPaidTag, isBillPaidNote } from '../src/lib/bills';
describe('bill reminders', () => {
  it('builds WhatsApp numbers', () => {
    expect(waNumber('98765 43210')).toBe('919876543210');
    expect(waNumber('+91 98765-43210')).toBe('919876543210');
    expect(waNumber('09876543210')).toBe('919876543210');
    expect(waNumber('12345')).toBeNull();
    expect(waNumber('')).toBeNull();
    expect(waNumber(null)).toBeNull();
    expect(waNumber('1'.repeat(30))).toBeNull();
  });
  it('writes the reminder with name, bill and amount', () => {
    const t = reminderText({ shop: 'Sharma Cold Drinks', customer: 'Mehta ji', label: 'P-3', paise: 23050 });
    expect(t).toContain('Mehta ji'); expect(t).toContain('₹230.50'); expect(t).toContain('#P-3'); expect(t).toContain('Sharma Cold Drinks');
    expect(reminderText({ label: '7', paise: 100000 })).toContain('₹1,00,000'.replace('1,00,000', '1,000'));
    expect(decodeURIComponent(encodeURIComponent(reminderText({ customer: 'राम & "सोनू" 50%', label: '1', paise: 5000 })))).toContain('राम & "सोनू" 50%');
  });
  it('recognises the paid tag exactly', () => {
    expect(isBillPaidNote(billPaidTag('12'), '12')).toBe(true);
    expect(isBillPaidNote(billPaidTag('12') + ' (UPI)', '12')).toBe(true);
    expect(isBillPaidNote(billPaidTag('12'), '1')).toBe(false);
    expect(isBillPaidNote('Bill #123 paid', '12')).toBe(false);
    expect(isBillPaidNote(null, '12')).toBe(false);
  });
});
