/**
 * Parses free-form daily hisaab text such as:
 *   Sting 2 boxes ₹1,020 60
 *   Cloud Nine - 2 box - 800 - 60 pcs
 *   Gas: 820
 *   16 October Collection: ₹7,544
 * into structured purchases / expenses / collections for the user to review.
 * Amounts are returned in rupees (the review screen edits rupees; the server converts to paise on save).
 */

export interface ParsedPurchase { item: string; qty: number; unit: string; pieces: number | null; total: number; product_id?: number | null; line: string }
export interface ParsedExpense { category: string; amount: number; notes?: string | null; line: string }
export interface ParsedCollection { amount: number; mode: 'cash' | 'upi' | 'card' | 'credit'; notes?: string | null; line: string }
export interface ParsedEntries {
  date: string | null;
  purchases: ParsedPurchase[];
  expenses: ParsedExpense[];
  collections: ParsedCollection[];
  unparsed: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const UNIT_RE = /(\d+(?:\.\d+)?)\s*(boxes|box|bx|crates?|packs?|packets?|cartons?|ctns?|cases?|trays?|dozens?|dz|kgs?|kilos?|bottles?|bags?|bundles?|sacks?|litres?|liters?|ltrs?)\b/i;
const PIECES_RE = /(\d+)\s*(pcs|pieces|piece|pc|nos|units|bottles? each)\b|\((\d+)\)/i;
const COLLECTION_RE = /\b(collection|collected|sales?|sold|bikri|galla|counter|income|received)\b/i;
const MODE_RE = /\b(upi|gpay|phonepe|paytm|card|credit|udhaar|udhar)\b/i;
const NUM_RE = /(₹|rs\.?|inr|=)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)/gi;

const normUnit = (u: string) => {
  const l = u.toLowerCase();
  if (l.startsWith('box') || l === 'bx') return 'box';
  if (l.startsWith('crate')) return 'crate';
  if (l.startsWith('pack')) return 'pack';
  if (l.startsWith('carton') || l.startsWith('ctn')) return 'carton';
  if (l.startsWith('case')) return 'case';
  if (l.startsWith('tray')) return 'tray';
  if (l.startsWith('doz') || l === 'dz') return 'dozen';
  if (l.startsWith('kg') || l.startsWith('kilo')) return 'kg';
  if (l.startsWith('bottle')) return 'bottle';
  if (l.startsWith('bag')) return 'bag';
  if (l.startsWith('bundle')) return 'bundle';
  if (l.startsWith('sack')) return 'sack';
  if (l.startsWith('l')) return 'litre';
  return l;
};
const toNum = (s: string) => Number(s.replace(/,/g, ''));

export function parseDate(text: string, defaultYear: number): string | null {
  const t = text.toLowerCase();
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return valid(y, +m[2], +m[1]); }
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?(?:,?\s+(\d{4}))?/);
  if (m && MONTHS[m[2]]) return valid(m[3] ? +m[3] : defaultYear, MONTHS[m[2]], +m[1]);
  m = t.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/);
  if (m && MONTHS[m[1]]) return valid(m[3] ? +m[3] : defaultYear, MONTHS[m[1]], +m[2]);
  return null;
}
function valid(y: number, mo: number, d: number): string | null {
  const s = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(s + 'T00:00:00Z');
  return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === s ? s : null;
}
function stripDate(text: string): string {
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/, ' ')
    .replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/, ' ')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:,?\s+\d{4})?/i, ' ')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/i, ' ');
}

export interface ParseContext {
  defaultYear: number;
  products: { id: number; name: string; pieces_per_unit: number }[];
  categories: string[];
}

export function findProduct(name: string, products: ParseContext['products']) {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!n) return null;
  return products.find((p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n)
    ?? products.find((p) => { const q = p.name.toLowerCase().replace(/[^a-z0-9]/g, ''); return q.length > 2 && (q.startsWith(n) || n.startsWith(q)); })
    ?? null;
}

export function parseText(text: string, ctx: ParseContext): ParsedEntries {
  const out: ParsedEntries = { date: null, purchases: [], expenses: [], collections: [], unparsed: [] };
  const lines = text.split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean);
  for (const raw of lines) {
    const line = raw.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^[-=_*#\s]+$/.test(line) || /^(item|total|grand total)\b/i.test(line)) continue;
    const d = parseDate(line, ctx.defaultYear);
    if (d && !out.date) out.date = d;
    const body = d ? stripDate(line) : line;
    const nums = [...body.matchAll(NUM_RE)];
    if (!nums.length) { if (!d) out.unparsed.push(raw); continue; }

    // Collections
    if (COLLECTION_RE.test(body)) {
      const amt = pickAmount(nums);
      const mm = body.match(MODE_RE)?.[1]?.toLowerCase();
      const mode = !mm ? 'cash' : mm === 'card' ? 'card' : mm === 'credit' || mm.startsWith('udh') ? 'credit' : 'upi';
      if (amt > 0) out.collections.push({ amount: amt, mode, notes: null, line: raw });
      else out.unparsed.push(raw);
      continue;
    }

    // Purchases (have a quantity with a unit, or the name matches a known product)
    const um = body.match(UNIT_RE);
    const nameMatch = body.match(/^([^\d₹=:]+?)\s*[-:=–]*\s*(?=₹|rs\.?|\d)/i);
    const name = (nameMatch?.[1] ?? '').replace(/[-:=–,]+$/, '').trim();
    const prod = name ? findProduct(name, ctx.products) : null;
    if (um || (prod && nums.length >= 2)) {
      let rest = body;
      let qty = 1, unit = 'box';
      if (um) { qty = toNum(um[1]); unit = normUnit(um[2]); rest = rest.replace(um[0], ' '); }
      let pieces: number | null = null;
      const pm = rest.match(PIECES_RE);
      if (pm) { pieces = toNum(pm[1] ?? pm[3]); rest = rest.replace(pm[0], ' '); }
      const restNums = [...rest.slice(name.length).matchAll(NUM_RE)];
      let total = 0;
      const marked = restNums.find((n) => n[1]);
      if (marked) total = toNum(marked[2]);
      else if (restNums.length) total = toNum(restNums[0][2]);
      if (!um && restNums.length >= 2 && !marked) { qty = toNum(restNums[0][2]); total = toNum(restNums[1][2]); }
      if (pieces === null) {
        const others = restNums.filter((n) => n !== marked && toNum(n[2]) !== total);
        if (others.length) pieces = toNum(others[others.length - 1][2]);
      }
      if (pieces === null && prod) pieces = Math.round(qty * prod.pieces_per_unit);
      if (name && total > 0) {
        out.purchases.push({ item: prod?.name ?? titleCase(name), qty, unit, pieces, total, product_id: prod?.id ?? null, line: raw });
        continue;
      }
    }

    // Expenses: "<label> <amount>"
    if (name) {
      const amt = pickAmount(nums);
      const cat = ctx.categories.find((c) => c.toLowerCase() === name.toLowerCase().replace(/[^a-z\- ]/gi, '').trim())
        ?? ctx.categories.find((c) => name.toLowerCase().replace(/[^a-z]/g, '') === c.toLowerCase().replace(/[^a-z]/g, ''));
      if (amt > 0) { out.expenses.push({ category: cat ?? titleCase(name), amount: amt, notes: null, line: raw }); continue; }
    }
    out.unparsed.push(raw);
  }
  return out;
}

function pickAmount(nums: RegExpMatchArray[]): number {
  const marked = nums.find((n) => n[1]);
  if (marked) return toNum(marked[2]);
  return Math.max(...nums.map((n) => toNum(n[2])));
}
function titleCase(s: string) {
  return s.replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80);
}
