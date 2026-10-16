import { describe, it, expect } from 'vitest';
import { computeReport, type ReportInput } from '../src/lib/calc';

const products = [
  { id: 1, name: 'Sting', unit: 'box', pieces_per_unit: 30, default_unit_cost_paise: null, sale_price_paise: 2000 },
  { id: 2, name: 'Zeera', unit: 'box', pieces_per_unit: 24, default_unit_cost_paise: null, sale_price_paise: 1000 },
];
const base = (over: Partial<ReportInput>): ReportInput => ({ from: '2026-10-16', to: '2026-10-16', products, purchases: [], counts: [], money: [], closings: [], ...over });

describe('calc', () => {
  it('computes totals, cash and withholds profit until stock is counted', () => {
    const r = computeReport(base({
      purchases: [{ d: '2026-10-16', product_id: 1, pieces: 60, cost: 102000, units: 2 }, { d: '2026-10-16', product_id: 2, pieces: 24, cost: 17000, units: 1 }],
      money: [
        { d: '2026-10-16', kind: 'purchase', mode: 'cash', amount: 119000 },
        { d: '2026-10-16', kind: 'expense', mode: 'cash', amount: 82000 },
        { d: '2026-10-16', kind: 'collection', mode: 'cash', amount: 754400 },
      ],
      closings: [{ d: '2026-10-16', opening: 100000, counted: 650000 }],
    }));
    const d = r.days[0];
    expect(d.purchases.total).toBe(119000);
    expect(d.net_cash_flow).toBe(754400 - 119000 - 82000);
    expect(d.cash.expected).toBe(100000 + 754400 - 119000 - 82000);
    expect(d.cash.difference).toBe(650000 - 653400);
    expect(d.profit.status).toBe('unavailable');
    expect(d.discrepancies.some((x) => x.type === 'cash_short')).toBe(true);
  });

  it('computes actual profit from closing counts with weighted average cost', () => {
    const r = computeReport(base({
      from: '2026-10-15', to: '2026-10-16',
      purchases: [{ d: '2026-10-15', product_id: 1, pieces: 60, cost: 102000, units: 2 }],
      counts: [{ d: '2026-10-15', product_id: 1, closing: 40 }, { d: '2026-10-16', product_id: 1, closing: 10 }],
      money: [{ d: '2026-10-15', kind: 'collection', mode: 'cash', amount: 40000 }, { d: '2026-10-16', kind: 'collection', mode: 'upi', amount: 60000 }],
    }));
    const [d1, d2] = r.days;
    expect(d1.stock.sold_pieces).toBe(20);
    expect(d1.profit.status).toBe('actual');
    expect(d1.profit.cogs).toBe(34000); // 20 × 1700
    expect(d1.profit.net).toBe(6000);
    expect(d2.stock.sold_pieces).toBe(30);
    expect(d2.profit.cogs).toBe(51000);
    expect(r.totals.profit.status).toBe('actual');
    expect(r.totals.profit.net).toBe(6000 + 9000);
    expect(r.totals.products[0]).toMatchObject({ opening: 0, purchased: 60, sold_known: 50, closing: 10 });
  });

  it('tracks outstanding payable and receivable', () => {
    const r = computeReport(base({
      money: [
        { d: '2026-10-10', kind: 'purchase', mode: 'credit', amount: 50000 },
        { d: '2026-10-12', kind: 'to_supplier', mode: 'cash', amount: 20000 },
        { d: '2026-10-16', kind: 'collection', mode: 'credit', amount: 15000 },
      ],
    }));
    expect(r.days[0].outstanding).toEqual({ payable: 30000, receivable: 15000 });
  });

  it('treats a first count with no purchases as opening stock', () => {
    const r = computeReport(base({ counts: [{ d: '2026-10-16', product_id: 2, closing: 12 }] }));
    expect(r.days[0].discrepancies[0].type).toBe('opening_stock');
    expect(r.days[0].stock.closing_pieces).toBe(12);
  });
});
