/**
 * DailyKhata financial engine. Pure functions only (no DB access) so every number
 * shown to users is computed in one place on the server and can be unit-tested.
 *
 * Conventions
 *  - All money is integer paise.
 *  - Cash balance and profit are deliberately separate:
 *      net cash flow  = money actually received − money actually paid (any mode except credit)
 *      drawer cash    = opening cash + cash in − cash out, compared with the counted cash
 *      profit         = sales revenue − cost of goods sold − expenses, ONLY when the day's
 *                       closing stock was counted for every product that had stock
 *  - Stock sold is derived from physical closing counts:
 *      sold = opening stock + purchased − counted closing
 *    Days without a count carry stock forward (sales unknown) and the next count absorbs them.
 */
import { addDays } from './dates';

export interface ProductIn {
  id: number;
  name: string;
  unit: string;
  pieces_per_unit: number;
  default_unit_cost_paise: number | null;
  sale_price_paise: number | null;
}
export interface PurchaseAggIn { d: string; product_id: number; pieces: number; cost: number; units: number }
export interface CountIn { d: string; product_id: number; closing: number }
export type MoneyKind = 'purchase' | 'expense' | 'collection' | 'to_supplier' | 'from_customer';
export interface MoneyIn { d: string; kind: MoneyKind; mode: string; amount: number }
export interface ClosingIn { d: string; opening: number | null; counted: number }

export interface ReportInput {
  from: string;
  to: string;
  products: ProductIn[];
  purchases: PurchaseAggIn[]; // every aggregated purchase row with d <= to
  counts: CountIn[];          // every stock count with d <= to
  money: MoneyIn[];           // every money row with d <= to (aggregated by day/kind/mode)
  closings: ClosingIn[];      // every cash closing with d <= to
  detail?: boolean;           // include per-product rows for each day
}

export interface ProductDay {
  product_id: number;
  name: string;
  unit: string;
  opening: number;
  purchased: number;
  closing: number;          // counted, or expected (opening + purchased) when not counted
  counted: boolean;
  sold: number | null;      // null when no count that day
  avg_cost_per_piece: number | null; // paise, weighted average of all purchases so far
  cogs: number | null;
  sale_value: number | null; // sold × sale price
  stock_value: number | null; // closing × avg cost
}

export interface Discrepancy { type: string; severity: 'info' | 'warning' | 'error'; message: string; amount?: number; product_id?: number }

export interface DayReport {
  date: string;
  purchases: { total: number; cash: number; bank: number; credit: number; pieces: number; units: number };
  expenses: { total: number; cash: number; bank: number; credit: number };
  collections: { total: number; cash: number; upi: number; card: number; credit: number };
  payments: { to_supplier: number; from_customer: number; to_supplier_cash: number; from_customer_cash: number };
  net_cash_flow: number;
  cash: { opening: number | null; cash_in: number; cash_out: number; expected: number | null; counted: number | null; difference: number | null };
  stock: { purchased_pieces: number; sold_pieces: number | null; sold_pieces_known: number; closing_pieces: number; stock_value: number; counted_products: number; products_needing_count: number };
  profit: {
    status: 'actual' | 'unavailable' | 'no_activity';
    reason: string | null;
    revenue: number;
    cogs: number | null;
    gross: number | null;
    expenses: number;
    net: number | null;
    expected_sales_value: number | null;
  };
  cash_basis_result: number; // collections − purchases − expenses (NOT profit; stock may remain unsold)
  outstanding: { payable: number; receivable: number };
  discrepancies: Discrepancy[];
  products?: ProductDay[];
}

export interface PeriodTotals {
  from: string;
  to: string;
  days: number;
  purchases: number; expenses: number; collections: number; credit_sales: number;
  payments_to_supplier: number; payments_from_customer: number;
  net_cash_flow: number;
  cash_basis_result: number;
  purchased_pieces: number;
  sold_pieces_known: number;
  profit: {
    status: 'actual' | 'partial' | 'unavailable' | 'no_activity';
    days_with_profit: number; days_with_activity: number;
    revenue: number; cogs: number; gross: number; expenses: number; net: number;
    note: string;
  };
  cash_difference_total: number;
  outstanding: { payable: number; receivable: number };
  closing_stock_value: number;
  discrepancy_count: number;
  products: { product_id: number; name: string; unit: string; opening: number; purchased: number; sold_known: number; closing: number; closing_counted: boolean; purchase_cost: number }[];
}

function emptyDay(date: string): DayReport {
  return {
    date,
    purchases: { total: 0, cash: 0, bank: 0, credit: 0, pieces: 0, units: 0 },
    expenses: { total: 0, cash: 0, bank: 0, credit: 0 },
    collections: { total: 0, cash: 0, upi: 0, card: 0, credit: 0 },
    payments: { to_supplier: 0, from_customer: 0, to_supplier_cash: 0, from_customer_cash: 0 },
    net_cash_flow: 0,
    cash: { opening: null, cash_in: 0, cash_out: 0, expected: null, counted: null, difference: null },
    stock: { purchased_pieces: 0, sold_pieces: null, sold_pieces_known: 0, closing_pieces: 0, stock_value: 0, counted_products: 0, products_needing_count: 0 },
    profit: { status: 'no_activity', reason: null, revenue: 0, cogs: null, gross: null, expenses: 0, net: null, expected_sales_value: null },
    cash_basis_result: 0,
    outstanding: { payable: 0, receivable: 0 },
    discrepancies: [],
  };
}

const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function computeReport(input: ReportInput): { days: DayReport[]; totals: PeriodTotals } {
  const { from, to, products } = input;

  // ---- index inputs by date ----
  const byDate = <T extends { d: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { if (r.d > to) continue; (m.get(r.d) ?? m.set(r.d, []).get(r.d)!).push(r); }
    return m;
  };
  const purchasesByDate = byDate(input.purchases);
  const countsByDate = byDate(input.counts);
  const moneyByDate = byDate(input.money);
  const closingByDate = new Map(input.closings.filter((c) => c.d <= to).map((c) => [c.d, c]));

  const allDates = [
    ...purchasesByDate.keys(), ...countsByDate.keys(), ...moneyByDate.keys(), ...closingByDate.keys(),
  ].filter((d) => d < from).sort();
  const start = allDates.length ? allDates[0] : from;

  // ---- per-product running state ----
  interface PState { stock: number; everCounted: boolean; hadPurchase: boolean; costSum: number; pieceSum: number; lastCountDate: string | null }
  const pstate = new Map<number, PState>();
  for (const p of products) pstate.set(p.id, { stock: 0, everCounted: false, hadPurchase: false, costSum: 0, pieceSum: 0, lastCountDate: null });
  const avgCost = (p: ProductIn, s: PState): number | null => {
    if (s.pieceSum > 0) return s.costSum / s.pieceSum;
    if (p.default_unit_cost_paise != null && p.pieces_per_unit > 0) return p.default_unit_cost_paise / p.pieces_per_unit;
    return null;
  };

  // ---- running money state ----
  let payable = 0, receivable = 0;
  let lastCounted: number | null = null; // last counted drawer cash (carried forward as next opening)
  let cashSinceCount = 0;                // net drawer cash movement since the last count
  let haveCashAnchor = false;

  const days: DayReport[] = [];
  const periodProducts = new Map<number, { opening: number; purchased: number; sold_known: number; closing: number; closing_counted: boolean; purchase_cost: number }>();

  for (let d = start; d <= to; d = addDays(d, 1)) {
    const inRange = d >= from;
    const day = emptyDay(d);

    // money
    for (const m of moneyByDate.get(d) ?? []) {
      const a = m.amount;
      if (m.kind === 'purchase') {
        day.purchases.total += a;
        if (m.mode === 'cash') day.purchases.cash += a; else if (m.mode === 'bank') day.purchases.bank += a; else day.purchases.credit += a;
      } else if (m.kind === 'expense') {
        day.expenses.total += a;
        if (m.mode === 'cash') day.expenses.cash += a; else if (m.mode === 'bank') day.expenses.bank += a; else day.expenses.credit += a;
      } else if (m.kind === 'collection') {
        day.collections.total += a;
        if (m.mode === 'cash' || m.mode === 'upi' || m.mode === 'card' || m.mode === 'credit') day.collections[m.mode] += a;
      } else if (m.kind === 'to_supplier') {
        day.payments.to_supplier += a; if (m.mode === 'cash') day.payments.to_supplier_cash += a;
      } else if (m.kind === 'from_customer') {
        day.payments.from_customer += a; if (m.mode === 'cash') day.payments.from_customer_cash += a;
      }
    }
    payable += day.purchases.credit + day.expenses.credit - day.payments.to_supplier;
    receivable += day.collections.credit - day.payments.from_customer;
    day.outstanding = { payable, receivable };

    const received = day.collections.cash + day.collections.upi + day.collections.card + day.payments.from_customer;
    const paid = day.purchases.cash + day.purchases.bank + day.expenses.cash + day.expenses.bank + day.payments.to_supplier;
    day.net_cash_flow = received - paid;
    day.cash_basis_result = day.collections.total - day.purchases.total - day.expenses.total;

    // drawer cash
    const cashIn = day.collections.cash + day.payments.from_customer_cash;
    const cashOut = day.purchases.cash + day.expenses.cash + day.payments.to_supplier_cash;
    day.cash.cash_in = cashIn; day.cash.cash_out = cashOut;
    const closing = closingByDate.get(d);
    let opening: number | null = haveCashAnchor ? (lastCounted ?? 0) + cashSinceCount : null;
    if (closing && closing.opening !== null) opening = closing.opening;
    day.cash.opening = opening;
    day.cash.expected = opening === null ? null : opening + cashIn - cashOut;
    if (closing) {
      day.cash.counted = closing.counted;
      day.cash.difference = day.cash.expected === null ? null : closing.counted - day.cash.expected;
      lastCounted = closing.counted; cashSinceCount = 0; haveCashAnchor = true;
    } else if (haveCashAnchor) {
      cashSinceCount += cashIn - cashOut;
    }

    // stock
    const purchasesToday = new Map<number, PurchaseAggIn>();
    for (const p of purchasesByDate.get(d) ?? []) {
      const ex = purchasesToday.get(p.product_id);
      if (ex) { ex.pieces += p.pieces; ex.cost += p.cost; ex.units += p.units; } else purchasesToday.set(p.product_id, { ...p });
      day.purchases.pieces += p.pieces; day.purchases.units += p.units;
    }
    const countsToday = new Map((countsByDate.get(d) ?? []).map((c) => [c.product_id, c.closing]));

    let cogs = 0, cogsComplete = true, expectedSales = 0, expectedSalesKnown = true, soldKnown = 0, anySold = false;
    const productRows: ProductDay[] = [];
    for (const p of products) {
      const s = pstate.get(p.id)!;
      const pur = purchasesToday.get(p.id);
      const opening = s.stock;
      const purchased = pur?.pieces ?? 0;
      if (pur) { s.costSum += pur.cost; s.pieceSum += pur.pieces; }
      const ac = avgCost(p, s);
      const counted = countsToday.has(p.id);
      let sold: number | null = null;
      let closingPieces = opening + purchased;
      if (counted) {
        const c = countsToday.get(p.id)!;
        const isBaseline = !s.everCounted && !s.hadPurchase && !pur;
        if (isBaseline) {
          sold = null; // first count with no prior purchases = opening stock baseline
          if (inRange) day.discrepancies.push({ type: 'opening_stock', severity: 'info', message: `${p.name}: opening stock recorded (${c} pcs)`, product_id: p.id });
        } else {
          sold = opening + purchased - c;
          if (sold < 0) {
            if (inRange) day.discrepancies.push({ type: 'stock_excess', severity: 'warning', product_id: p.id,
              message: `${p.name}: counted ${c} pcs but only ${opening + purchased} expected — missing purchase entry?` });
            sold = 0;
          }
          if (s.lastCountDate && addDays(s.lastCountDate, 1) !== d && inRange) {
            day.discrepancies.push({ type: 'multi_day_sales', severity: 'info', product_id: p.id,
              message: `${p.name}: sales since last count on ${s.lastCountDate} attributed to this day` });
          }
        }
        closingPieces = c;
        s.everCounted = true; s.lastCountDate = d;
      }
      if (pur) s.hadPurchase = true;
      s.stock = closingPieces;

      const needsCount = opening > 0 || purchased > 0;
      if (needsCount) day.stock.products_needing_count++;
      if (counted) day.stock.counted_products++;
      if (needsCount && !counted) cogsComplete = false;
      let pc: number | null = null, sv: number | null = null;
      if (sold !== null) {
        soldKnown += sold; if (sold > 0) anySold = true;
        if (ac === null) { if (sold > 0) cogsComplete = false; } else { pc = Math.round(sold * ac); cogs += pc; }
        if (p.sale_price_paise == null) { if (sold > 0) expectedSalesKnown = false; } else { sv = sold * p.sale_price_paise; expectedSales += sv; }
      }
      const stockValue = ac === null ? null : Math.round(closingPieces * ac);
      day.stock.closing_pieces += closingPieces;
      day.stock.stock_value += stockValue ?? 0;
      if (inRange) {
        let pp = periodProducts.get(p.id);
        if (!pp) { pp = { opening, purchased: 0, sold_known: 0, closing: 0, closing_counted: false, purchase_cost: 0 }; periodProducts.set(p.id, pp); }
        pp.purchased += purchased; pp.purchase_cost += pur?.cost ?? 0; pp.sold_known += sold ?? 0; pp.closing = closingPieces; pp.closing_counted = counted;
      }
      if (input.detail && (needsCount || counted)) {
        productRows.push({ product_id: p.id, name: p.name, unit: p.unit, opening, purchased, closing: closingPieces, counted, sold,
          avg_cost_per_piece: ac === null ? null : Math.round(ac * 100) / 100, cogs: pc, sale_value: sv, stock_value: stockValue });
      }
    }
    day.stock.purchased_pieces = day.purchases.pieces;
    day.stock.sold_pieces_known = soldKnown;
    day.stock.sold_pieces = day.stock.counted_products > 0 ? soldKnown : null;
    if (input.detail) day.products = productRows;

    // profit
    const revenue = day.collections.total;
    const activity = revenue > 0 || day.purchases.total > 0 || day.expenses.total > 0 || day.stock.products_needing_count > 0;
    day.profit.revenue = revenue;
    day.profit.expenses = day.expenses.total;
    if (!activity) {
      day.profit.status = 'no_activity';
    } else if (day.stock.products_needing_count === 0 && revenue === 0) {
      // only expenses recorded and no stock in hand
      day.profit.status = 'actual'; day.profit.cogs = 0; day.profit.gross = 0; day.profit.net = -day.expenses.total;
    } else if (!cogsComplete) {
      day.profit.status = 'unavailable';
      const missing = day.stock.products_needing_count - day.stock.counted_products;
      day.profit.reason = missing > 0
        ? `Closing stock not counted for ${missing} product${missing > 1 ? 's' : ''} — count stock to calculate profit`
        : 'Cost price missing for a sold product — set a default cost';
    } else if (anySold && revenue === 0) {
      day.profit.status = 'unavailable';
      day.profit.reason = 'Stock was sold but no collection was recorded';
    } else {
      day.profit.status = 'actual';
      day.profit.cogs = cogs;
      day.profit.gross = revenue - cogs;
      day.profit.net = revenue - cogs - day.expenses.total;
    }
    day.profit.expected_sales_value = day.stock.counted_products > 0 && expectedSalesKnown ? expectedSales : null;

    // discrepancies
    if (inRange) {
      if (day.cash.difference !== null && day.cash.difference !== 0) {
        const short = day.cash.difference < 0;
        day.discrepancies.push({ type: short ? 'cash_short' : 'cash_excess', severity: Math.abs(day.cash.difference) >= 10000 ? 'error' : 'warning', amount: day.cash.difference,
          message: `Cash ${short ? 'short' : 'excess'} by ${fmt(Math.abs(day.cash.difference))} (expected ${fmt(day.cash.expected!)}, counted ${fmt(day.cash.counted!)})` });
      }
      if (day.profit.status === 'actual' && day.profit.expected_sales_value !== null && day.profit.expected_sales_value > 0) {
        const gap = day.profit.expected_sales_value - revenue;
        if (Math.abs(gap) > Math.max(100, day.profit.expected_sales_value * 0.02)) {
          day.discrepancies.push({ type: gap > 0 ? 'collection_short' : 'collection_excess', severity: 'warning', amount: -gap,
            message: `Collection ${fmt(revenue)} vs expected sales ${fmt(day.profit.expected_sales_value)} at sale prices (${gap > 0 ? 'short' : 'over'} by ${fmt(Math.abs(gap))})` });
        }
      }
      if (anySold && revenue === 0) day.discrepancies.push({ type: 'missing_collection', severity: 'warning', message: 'Stock reduced but no collection entered' });
      days.push(day);
    }
  }

  // ---- period totals ----
  const t: PeriodTotals = {
    from, to, days: days.length,
    purchases: 0, expenses: 0, collections: 0, credit_sales: 0, payments_to_supplier: 0, payments_from_customer: 0,
    net_cash_flow: 0, cash_basis_result: 0, purchased_pieces: 0, sold_pieces_known: 0,
    profit: { status: 'no_activity', days_with_profit: 0, days_with_activity: 0, revenue: 0, cogs: 0, gross: 0, expenses: 0, net: 0, note: '' },
    cash_difference_total: 0,
    outstanding: days.length ? days[days.length - 1].outstanding : { payable, receivable },
    closing_stock_value: days.length ? days[days.length - 1].stock.stock_value : 0,
    discrepancy_count: 0,
    products: [],
  };
  for (const d of days) {
    t.purchases += d.purchases.total; t.expenses += d.expenses.total; t.collections += d.collections.total;
    t.credit_sales += d.collections.credit; t.payments_to_supplier += d.payments.to_supplier; t.payments_from_customer += d.payments.from_customer;
    t.net_cash_flow += d.net_cash_flow; t.cash_basis_result += d.cash_basis_result;
    t.purchased_pieces += d.stock.purchased_pieces; t.sold_pieces_known += d.stock.sold_pieces_known;
    t.cash_difference_total += d.cash.difference ?? 0;
    t.discrepancy_count += d.discrepancies.filter((x) => x.severity !== 'info').length;
    if (d.profit.status !== 'no_activity') t.profit.days_with_activity++;
    if (d.profit.status === 'actual') {
      t.profit.days_with_profit++;
      t.profit.revenue += d.profit.revenue; t.profit.cogs += d.profit.cogs ?? 0; t.profit.gross += d.profit.gross ?? 0;
      t.profit.expenses += d.profit.expenses; t.profit.net += d.profit.net ?? 0;
    }
  }
  const pt = t.profit;
  if (pt.days_with_activity === 0) { pt.status = 'no_activity'; pt.note = 'No entries in this period'; }
  else if (pt.days_with_profit === pt.days_with_activity) { pt.status = 'actual'; pt.note = 'Profit based on counted stock for every day'; }
  else if (pt.days_with_profit > 0) { pt.status = 'partial'; pt.note = `Profit covers ${pt.days_with_profit} of ${pt.days_with_activity} active days (others lack a closing stock count)`; }
  else { pt.status = 'unavailable'; pt.note = 'Count closing stock to calculate actual profit'; }

  for (const p of products) {
    const pp = periodProducts.get(p.id);
    if (!pp || (pp.opening === 0 && pp.purchased === 0 && pp.closing === 0)) continue;
    t.products.push({ product_id: p.id, name: p.name, unit: p.unit, ...pp });
  }
  return { days, totals: t };
}
