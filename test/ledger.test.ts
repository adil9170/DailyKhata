import { describe, it, expect } from 'vitest';
import { computeReport } from '../src/lib/calc';
import { buildReportInput, categoryTotals, partyBalances, type MirrorRows } from '../src/lib/ledger';
import { buildSummary } from '../src/lib/summary';

const prod = (id: number, name: string, ppu: number) => ({ id, name, unit: 'box', pieces_per_unit: ppu, default_unit_cost_paise: null, sale_price_paise: null });
const mirror = (over: Partial<MirrorRows> = {}): MirrorRows => ({
  products: [prod(1, 'Sting', 30), prod(2, 'cloud nine', 30)], expense_categories: [{ id: 1, name: 'Gas' }, { id: 2, name: 'Wi-Fi' }],
  purchases: [], expenses: [], collections: [], payments: [], stock_counts: [], day_closings: [], ...over,
});
const D = '2026-10-16';

describe('ledger (offline copy of the engine inputs)', () => {
  it('reproduces the sample day: ₹3,190 bought, ₹4,205 expenses, ₹7,544 collected', () => {
    const m = mirror({
      purchases: [
        { id: 1, entry_date: D, product_id: 1, qty_units: 2, pieces: 60, total_cost_paise: 102000, payment_mode: 'cash' },
        { id: 2, entry_date: D, product_id: 2, qty_units: 2, pieces: 60, total_cost_paise: 80000, payment_mode: 'cash' },
        { id: 3, entry_date: D, product_id: 2, qty_units: 1, pieces: 30, total_cost_paise: 40000, payment_mode: 'cash' },
      ],
      expenses: [{ id: 1, entry_date: D, category_id: 1, amount_paise: 82000, payment_mode: 'cash' }, { id: 2, entry_date: D, category_id: 2, amount_paise: 250000, payment_mode: 'cash' }],
      collections: [{ id: 1, entry_date: D, amount_paise: 754400, mode: 'cash' }],
      stock_counts: [{ id: 1, entry_date: D, product_id: 1, closing_pieces: 20 }, { id: 2, entry_date: D, product_id: 2, closing_pieces: 30 }],
      day_closings: [{ id: 1, entry_date: D, opening_cash_paise: 100000, counted_cash_paise: 500000 }],
    });
    const r = computeReport(buildReportInput(m, D, D, true));
    const d = r.days[0];
    expect(d.purchases.total).toBe(222000);
    expect(d.purchases.pieces).toBe(150);
    expect(d.expenses.total).toBe(332000);
    expect(d.collections.total).toBe(754400);
    expect(d.net_cash_flow).toBe(754400 - 222000 - 332000);
    expect(d.cash.expected).toBe(100000 + 754400 - 222000 - 332000);
    expect(d.profit.status).toBe('actual');
    // Sting: 60 bought, 20 left -> 40 sold at 1700/pc; Cloud Nine: 90 bought, 30 left -> 60 sold at 1333.33/pc
    expect(d.products!.find((p) => p.name === 'Sting')!.sold).toBe(40);
    expect(d.products!.find((p) => p.name === 'cloud nine')!.sold).toBe(60);
  });

  it('ignores rows after the end date and sorts product names case-insensitively', () => {
    const m = mirror({ purchases: [{ id: 1, entry_date: '2026-10-20', product_id: 1, qty_units: 1, pieces: 30, total_cost_paise: 1000, payment_mode: 'cash' }] });
    const input = buildReportInput(m, D, D);
    expect(input.purchases).toHaveLength(0);
    expect(input.products.map((p) => p.name)).toEqual(['cloud nine', 'Sting']);
  });

  it('summarises into weekly buckets and category totals', () => {
    const m = mirror({
      expenses: [{ id: 1, entry_date: '2026-10-12', category_id: 1, amount_paise: 500, payment_mode: 'cash' }, { id: 2, entry_date: '2026-10-14', category_id: 2, amount_paise: 900, payment_mode: 'cash' }, { id: 3, entry_date: '2026-10-19', category_id: 1, amount_paise: 100, payment_mode: 'cash' }],
      collections: [{ id: 1, entry_date: '2026-10-13', amount_paise: 3000, mode: 'cash' }],
    });
    const rep = computeReport(buildReportInput(m, '2026-10-12', '2026-10-19'));
    const s = buildSummary(rep, categoryTotals(m, '2026-10-12', '2026-10-19'), 'week');
    expect(s.series.map((b) => b.period)).toEqual(['2026-10-12', '2026-10-19']);
    expect(s.series[0].expenses).toBe(1400);
    expect(s.expenses_by_category).toEqual([{ category: 'Wi-Fi', amount: 900 }, { category: 'Gas', amount: 600 }]);
  });

  it('tracks supplier credit and udhaar balances per party', () => {
    const m = mirror({
      purchases: [{ id: 1, entry_date: D, product_id: 1, qty_units: 1, pieces: 30, total_cost_paise: 50000, payment_mode: 'credit', supplier: 'Raju Traders' }],
      payments: [{ id: 1, entry_date: D, direction: 'to_supplier', party: 'Raju Traders', amount_paise: 20000, mode: 'cash' }, { id: 2, entry_date: D, direction: 'from_customer', party: 'Ali', amount_paise: 1000, mode: 'cash' }],
      collections: [{ id: 1, entry_date: D, amount_paise: 4000, mode: 'credit', customer: 'Ali' }, { id: 2, entry_date: D, amount_paise: 100, mode: 'credit', customer: '' }],
    });
    const b = partyBalances(m);
    expect(b.payable).toEqual([{ party: 'Raju Traders', owed: 50000, paid: 20000, balance: 30000 }]);
    expect(b.receivable.map((x) => [x.party, x.balance])).toEqual([['Ali', 3000], ['Unnamed customer', 100]]);
  });
});
