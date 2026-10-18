// Turns the raw rows kept on the phone into the exact inputs the financial engine (calc.ts) expects.
// The Worker does the same aggregation in SQL (report.ts); this is the in-memory twin used for the offline copy.
// Pure and import-free of server code so the browser bundle can use it.
import type { ReportInput, MoneyIn, PurchaseAggIn } from './calc';

export interface Row { id: number; [k: string]: any }
export interface MirrorRows {
  products: Row[]; expense_categories: Row[]; purchases: Row[]; expenses: Row[];
  collections: Row[]; payments: Row[]; stock_counts: Row[]; day_closings: Row[];
}

const lc = (s: string) => String(s ?? '').toLowerCase();

export function buildReportInput(m: MirrorRows, from: string, to: string, detail = false): ReportInput {
  const products = [...m.products]
    .sort((a, b) => (lc(a.name) < lc(b.name) ? -1 : lc(a.name) > lc(b.name) ? 1 : 0))
    .map((p) => ({ id: p.id, name: p.name, unit: p.unit, pieces_per_unit: p.pieces_per_unit, default_unit_cost_paise: p.default_unit_cost_paise ?? null, sale_price_paise: p.sale_price_paise ?? null }));

  const purchases = new Map<string, PurchaseAggIn>();
  const money = new Map<string, MoneyIn>();
  const addMoney = (d: string, kind: MoneyIn['kind'], mode: string, amount: number) => {
    const k = `${d}|${kind}|${mode}`;
    const ex = money.get(k);
    if (ex) ex.amount += amount; else money.set(k, { d, kind, mode, amount });
  };
  for (const r of m.purchases) {
    if (r.entry_date > to) continue;
    const k = `${r.entry_date}|${r.product_id}`;
    const ex = purchases.get(k);
    if (ex) { ex.pieces += r.pieces; ex.cost += r.total_cost_paise; ex.units += r.qty_units; }
    else purchases.set(k, { d: r.entry_date, product_id: r.product_id, pieces: r.pieces, cost: r.total_cost_paise, units: r.qty_units });
    addMoney(r.entry_date, 'purchase', r.payment_mode, r.total_cost_paise);
  }
  for (const r of m.expenses) if (r.entry_date <= to) addMoney(r.entry_date, 'expense', r.payment_mode, r.amount_paise);
  for (const r of m.collections) if (r.entry_date <= to) addMoney(r.entry_date, 'collection', r.mode, r.amount_paise);
  for (const r of m.payments) if (r.entry_date <= to) addMoney(r.entry_date, r.direction, r.mode, r.amount_paise);

  return {
    from, to, detail, products,
    purchases: [...purchases.values()],
    counts: m.stock_counts.filter((r) => r.entry_date <= to).map((r) => ({ d: r.entry_date, product_id: r.product_id, closing: r.closing_pieces })),
    money: [...money.values()],
    closings: m.day_closings.filter((r) => r.entry_date <= to).map((r) => ({ d: r.entry_date, opening: r.opening_cash_paise ?? null, counted: r.counted_cash_paise })),
  };
}

/** Expense totals per category for a date range, biggest first. */
export function categoryTotals(m: MirrorRows, from: string, to: string): { category: string; amount: number }[] {
  const names = new Map(m.expense_categories.map((c) => [c.id, c.name as string]));
  const tot = new Map<string, number>();
  for (const e of m.expenses) {
    if (e.entry_date < from || e.entry_date > to) continue;
    const name = names.get(e.category_id) ?? 'Other';
    tot.set(name, (tot.get(name) ?? 0) + e.amount_paise);
  }
  return [...tot.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** Who we owe (suppliers) and who owes us (udhaar customers), per party. */
export function partyBalances(m: MirrorRows) {
  const group = (rows: { party: string; owed: number; paid: number }[]) => {
    const g = new Map<string, { party: string; owed: number; paid: number }>();
    for (const r of rows) { const e = g.get(r.party) ?? { party: r.party, owed: 0, paid: 0 }; e.owed += r.owed; e.paid += r.paid; g.set(r.party, e); }
    return [...g.values()].map((e) => ({ ...e, balance: e.owed - e.paid })).filter((e) => e.balance !== 0).sort((a, b) => b.balance - a.balance);
  };
  const name = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);
  const payable = group([
    ...m.purchases.filter((r) => r.payment_mode === 'credit').map((r) => ({ party: name(r.supplier, 'Unnamed supplier'), owed: r.total_cost_paise, paid: 0 })),
    ...m.payments.filter((r) => r.direction === 'to_supplier').map((r) => ({ party: name(r.party, 'Unnamed supplier'), owed: 0, paid: r.amount_paise })),
    ...m.expenses.filter((r) => r.payment_mode === 'credit').map((r) => ({ party: 'Expenses on credit', owed: r.amount_paise, paid: 0 })),
  ]);
  const receivable = group([
    ...m.collections.filter((r) => r.mode === 'credit').map((r) => ({ party: name(r.customer, 'Unnamed customer'), owed: r.amount_paise, paid: 0 })),
    ...m.payments.filter((r) => r.direction === 'from_customer').map((r) => ({ party: name(r.party, 'Unnamed customer'), owed: 0, paid: r.amount_paise })),
  ]);
  return { payable, receivable };
}
