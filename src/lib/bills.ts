// Bill validation and numbering rules, shared by the server and the phone (local-first) so both accept the same input.
import { fail, reqDate, toPaise, optStr, reqStr, oneOf } from './util';

export const BILL_MODES = ['cash', 'upi', 'card', 'credit'] as const;
export const MAX_BILL_ITEMS = 100;
export const MAX_RESERVE = 100;
const SERIES_RE = /^[A-Z][A-Z0-9]{0,11}$/;

export interface BillItem { name: string; qty: number; rate_paise: number; amount_paise: number }
export interface BillRecord {
  series: string; bill_no: number | null; customer: string | null; phone: string | null; items_json: string;
  subtotal_paise: number; discount_paise: number; total_paise: number; pay_mode: string; collection_client_id: string | null; entry_date: string;
}

/** "9876543210" -> "+919876543210"; keeps an explicit +country code; null when empty; throws on junk. */
export function cleanPhone(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') fail(422, 'Invalid phone number');
  const plus = v.trim().startsWith('+');
  let d = v.replace(/\D/g, '');
  if (!d) return null;
  if (!plus) { if (d.length === 12 && d.startsWith('91')) d = d.slice(2); else if (d.length === 11 && d.startsWith('0')) d = d.slice(1); }
  if (d.length < 7 || d.length > 15) fail(422, 'Phone number looks wrong');
  return plus || d.length > 10 ? '+' + d : '+91' + d;
}

export const billLabel = (series: string, no: number) => (series === 'A' ? `${no}` : `${series}-${no}`);

export function normalizeBill(b: any, today: string): BillRecord {
  if (!b || typeof b !== 'object') fail(422, 'Invalid bill');
  if (!Array.isArray(b.items) || !b.items.length) fail(422, 'Add at least one item');
  if (b.items.length > MAX_BILL_ITEMS) fail(422, `A bill can have at most ${MAX_BILL_ITEMS} items`);
  const items: BillItem[] = b.items.map((it: any, i: number) => {
    if (!it || typeof it !== 'object') fail(422, `Item ${i + 1} is invalid`);
    const name = reqStr(it.name, `Item ${i + 1} name`, 80);
    const qty = typeof it.qty === 'string' ? Number(it.qty) : it.qty;
    if (typeof qty !== 'number' || !isFinite(qty) || qty <= 0 || qty > 1e6) fail(422, `Quantity for ${name} must be between 0 and 1,000,000`);
    const rate_paise = toPaise(it.rate, `Rate for ${name}`);
    return { name, qty: Math.round(qty * 1000) / 1000, rate_paise, amount_paise: Math.round(qty * rate_paise) };
  });
  const subtotal = items.reduce((s, it) => s + it.amount_paise, 0);
  if (subtotal > 1e11) fail(422, 'Bill total is too large');
  const discount = b.discount === undefined || b.discount === null || b.discount === '' ? 0 : toPaise(b.discount, 'discount');
  const series = b.series === undefined || b.series === null || b.series === '' ? 'A' : String(b.series);
  if (!SERIES_RE.test(series)) fail(422, 'Invalid bill series');
  let bill_no: number | null = null;
  if (b.bill_no !== undefined && b.bill_no !== null && b.bill_no !== '') {
    bill_no = Number(b.bill_no);
    if (!Number.isInteger(bill_no) || bill_no < 1 || bill_no > 1e9) fail(422, 'Invalid bill number');
  }
  const customer = optStr(b.customer, 80);
  const pay_mode = oneOf(b.pay_mode ?? b.mode, BILL_MODES, 'payment mode', 'cash');
  if (pay_mode === 'credit' && !customer) fail(422, 'Udhaar needs the customer’s name');
  return {
    series, bill_no, customer, phone: cleanPhone(b.phone), items_json: JSON.stringify(items), subtotal_paise: subtotal,
    discount_paise: discount, total_paise: Math.max(0, subtotal - discount), pay_mode,
    collection_client_id: optStr(b.collection_client_id, 64), entry_date: b.date === undefined || b.date === null || b.date === '' ? today : reqDate(b.date),
  };
}

/** Clamp a reserve request to 1..MAX_RESERVE. */
export function reserveCount(v: unknown): number {
  const n = Math.floor(Number(v ?? 1));
  if (!Number.isFinite(n) || n < 1) fail(422, 'n must be at least 1');
  return Math.min(n, MAX_RESERVE);
}
