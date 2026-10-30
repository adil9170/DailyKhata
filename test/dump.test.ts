import { describe, it, expect } from 'vitest';
import { readDump } from '../src/lib/dump';

const ctx = { defaultYear: 2026, today: '2026-10-30', products: [{ id: 1, name: 'Sting', pieces_per_unit: 30 }, { id: 2, name: 'Campa Orange', pieces_per_unit: 24 }], categories: ['Gas', 'Wi-Fi', 'Water', 'Tea'] };
const ex = (r: ReturnType<typeof readDump>) => r.expenses.map((e) => [e.category, e.amount]);

describe('readDump', () => {
  it('reads a Hinglish paragraph', () => {
    const r = readDump(`aaj gas 820 diya, chai 40, auto 120. Ramesh salary 5000 gpay
bijli bill 1450 paid
Sharma se 3000 mila`, ctx);
    expect(ex(r)).toEqual([['Gas', 820], ['Tea', 40], ['Transport', 120], ['Salary', 5000], ['Electricity', 1450]]);
    expect(r.expenses[3]).toMatchObject({ notes: 'Ramesh', payment_mode: 'bank' });
    expect(r.expenses[0].payment_mode).toBe('cash');
    expect(r.collections).toEqual([expect.objectContaining({ amount: 3000, mode: 'cash', customer: 'Sharma' })]);
  });

  it('reads English sentences', () => {
    const r = readDump('Paid 500 for gas. Spent Rs. 60 on milk and 4 cups tea for 40. Gave Ramesh 2000 as salary. Got 1500 from Gupta via UPI.', ctx);
    expect(ex(r)).toEqual([['Gas', 500], ['Milk', 60], ['Tea', 40], ['Salary', 2000]]);
    expect(r.collections).toEqual([expect.objectContaining({ amount: 1500, mode: 'upi', customer: 'Gupta' })]);
  });

  it('splits a run-on WhatsApp line into pairs', () => {
    expect(ex(readDump('gas 820 chai 40 auto 120 ice 50', ctx))).toEqual([['Gas', 820], ['Tea', 40], ['Transport', 120], ['Ice', 50]]);
  });

  it('understands money formats', () => {
    const r = readDump('rent 15,000/-\nwifi ₹ 2,500\nlabour 1.5k\npetrol 300rs\nchai 4 x 10\nsamosa 20 + 30', ctx);
    expect(ex(r)).toEqual([['Rent', 15000], ['Wi-Fi', 2500], ['Salary', 1500], ['Transport', 300], ['Tea', 40], ['Tea', 50]]);
  });

  it('keeps stock purchases apart from expenses', () => {
    const r = readDump('Sting 2 boxes 1020 60\nbought 1 box campa orange 240\nCloud Nine 2 box 800 60 pcs', ctx);
    expect(r.purchases.map((p) => [p.item, p.qty, p.unit, p.total, p.pieces, p.product_id])).toEqual([
      ['Sting', 2, 'box', 1020, 60, 1], ['Campa Orange', 1, 'box', 240, 24, 2], ['Cloud Nine', 2, 'box', 800, 60, null]]);
    expect(r.expenses).toEqual([]);
  });

  it('skips totals, balances, phone numbers, times and percentages', () => {
    const r = readDump('call Raju 9876543210 at 5:30 pm\nTotal 3000\nbalance 200\ngst 18% included\nwater 875', ctx);
    expect(ex(r)).toEqual([['Water', 875]]);
    expect(r.skipped).toEqual(['Total 3000', 'balance 200']);
  });

  it('carries dates written on their own line and understands yesterday', () => {
    const r = readDump('16 Oct\ngas 820\nchai 30\n17/10/2026: wifi 500\nyesterday auto 80', ctx);
    expect(r.expenses.map((e) => [e.category, e.date])).toEqual([['Gas', '2026-10-16'], ['Tea', '2026-10-16'], ['Wi-Fi', '2026-10-17'], ['Transport', '2026-10-29']]);
  });

  it('reads Hindi script and udhaar', () => {
    const r = readDump('चाय ४०\nबिजली १२००\nVerma ne 500 diye\nRaju udhaar 300 sale', ctx);
    expect(ex(r)).toEqual([['Tea', 40], ['Electricity', 1200]]);
    expect(r.collections.map((c) => [c.amount, c.mode, c.customer])).toEqual([[500, 'cash', 'Verma'], [300, 'credit', 'Raju']]);
  });

  it('uses the words as the category when nothing matches, and ignores plain text', () => {
    const r = readDump('Dear diary, busy day today.\nnew board for shop 750\nsign painter 1200', ctx);
    expect(ex(r)).toEqual([['Board Shop', 750], ['Sign Painter', 1200]]);
    expect(r.skipped).toEqual([]);
  });
});
