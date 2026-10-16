import { describe, it, expect } from 'vitest';
import { parseText, parseDate } from '../src/lib/parser';

const ctx = { defaultYear: 2026, products: [{ id: 1, name: 'Sting', pieces_per_unit: 30 }, { id: 2, name: 'Zeera', pieces_per_unit: 24 }], categories: ['Gas', 'Wi-Fi', 'Water'] };

describe('parser', () => {
  it('parses dates', () => {
    expect(parseDate('16 October Collection', 2026)).toBe('2026-10-16');
    expect(parseDate('16/10/2026', 2026)).toBe('2026-10-16');
    expect(parseDate('Oct 5', 2026)).toBe('2026-10-05');
  });
  it('parses the sample hisaab', () => {
    const r = parseText(`Sting 2 boxes ₹1,020 60
Cloud Nine | 2 boxes | ₹800 | 60
Campa Orange 1 box 240 30
Zeera 1 box 170
Gas: 820
Wi-Fi ₹2,500
Water 875
16 October Collection: ₹7,544`, ctx);
    expect(r.date).toBe('2026-10-16');
    expect(r.purchases).toHaveLength(4);
    expect(r.purchases[0]).toMatchObject({ item: 'Sting', qty: 2, unit: 'box', total: 1020, pieces: 60, product_id: 1 });
    expect(r.purchases[1]).toMatchObject({ item: 'Cloud Nine', qty: 2, total: 800, pieces: 60 });
    expect(r.purchases[3]).toMatchObject({ item: 'Zeera', total: 170, pieces: 24 });
    expect(r.expenses.map((e) => [e.category, e.amount])).toEqual([['Gas', 820], ['Wi-Fi', 2500], ['Water', 875]]);
    expect(r.collections).toEqual([expect.objectContaining({ amount: 7544, mode: 'cash' })]);
    expect(r.unparsed).toEqual([]);
  });
});
