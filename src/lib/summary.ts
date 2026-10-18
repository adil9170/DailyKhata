// Dashboard summary: buckets the day-by-day engine output into days/weeks/months.
// Pure, so the Worker (online) and the browser (offline copy) produce identical dashboards.
import type { DayReport, PeriodTotals } from './calc';
import { addDays } from './dates';

export type Group = 'day' | 'week' | 'month';

export function bucketKey(date: string, group: string): string {
  if (group === 'month') return date.slice(0, 7);
  if (group === 'week') { const d = new Date(date + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; return addDays(date, -dow); }
  return date;
}

export function buildSummary(rep: { days: DayReport[]; totals: PeriodTotals }, categories: { category: string; amount: number }[], group: Group) {
  const buckets = new Map<string, any>();
  for (const d of rep.days) {
    const k = bucketKey(d.date, group);
    const b = buckets.get(k) ?? { period: k, purchases: 0, expenses: 0, collections: 0, net_cash_flow: 0, profit_net: 0, profit_days: 0, active_days: 0,
      purchased_pieces: 0, sold_pieces: 0, cash_difference: 0, stock_value: 0, payable: 0, receivable: 0 };
    b.purchases += d.purchases.total; b.expenses += d.expenses.total; b.collections += d.collections.total; b.net_cash_flow += d.net_cash_flow;
    b.purchased_pieces += d.stock.purchased_pieces; b.sold_pieces += d.stock.sold_pieces_known; b.cash_difference += d.cash.difference ?? 0;
    if (d.profit.status !== 'no_activity') b.active_days++;
    if (d.profit.status === 'actual') { b.profit_net += d.profit.net ?? 0; b.profit_days++; }
    b.stock_value = d.stock.stock_value; b.payable = d.outstanding.payable; b.receivable = d.outstanding.receivable;
    buckets.set(k, b);
  }
  const discrepancies = rep.days.flatMap((d) => d.discrepancies.filter((x) => x.severity !== 'info').map((x) => ({ date: d.date, ...x })));
  return { totals: rep.totals, series: [...buckets.values()], expenses_by_category: categories, discrepancies: discrepancies.slice(-100) };
}
