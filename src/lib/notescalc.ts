// Smart notes: type lines like a notebook, get the numbers added up.
//
//   Chai 3 x 12          → 36            quantity x price
//   Milk 2 x 35 = 70     → 70            anything after "=" is ignored (we calculate it ourselves)
//   Sting 2 boxes ₹1,020 60 pcs → 1,020  amounts with ₹ win; quantities (boxes, pcs, kg…) are skipped
//   500 + 200 - 50       → 650
//   1,500 - 10%          → 1,350         percentages work like a phone calculator
//   10% of 500           → 50
//   -200 returned        → -200          a leading minus makes it a deduction
//   Rent                 → (label)       lines without numbers are just text
//   total                → running total since the last "total" (not added again)
//
// Pure and import-free (shared by the browser bundle and the tests). Money is rounded to paise.
export type LineKind = 'amount' | 'label' | 'subtotal' | 'blank' | 'error';
export interface LineResult { kind: LineKind; value: number | null; hint?: string }

type Tok = { t: 'num'; v: number; src: string } | { t: 'op'; v: string } | { t: 'lp' } | { t: 'rp' } | { t: 'pct' } | { t: 'of' } | { t: 'word'; v: string };

const UNITS = new Set(['pcs', 'pc', 'piece', 'pieces', 'box', 'boxes', 'bx', 'crate', 'crates', 'pack', 'packs', 'packet', 'packets', 'kg', 'kgs', 'g', 'gm', 'gms', 'ltr', 'ltrs', 'litre', 'liter', 'litres', 'liters', 'l', 'ml', 'dozen', 'doz', 'nos', 'no', 'bottle', 'bottles', 'bag', 'bags', 'carton', 'ctn', 'units', 'unit']);
const SUBTOTAL = /^(sub\s*total|subtotal|total|sum|jod|kul|योग|कुल)\s*[:=]?$/i;

function normalise(line: string): string {
  return line
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))        // Devanagari digits
    .replace(/[−–—]/g, '-')
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, ' date ')        // 16/10/2026 is a date, not a division
    .replace(/\b\d{8,}\b/g, ' phone ')                                // long digit strings are phone numbers
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1')                             // 1,020 → 1020 (Indian and Western grouping)
    .replace(/₹|\brs\.?(?=\s*\d)|\binr\b/gi, ' ₹ ');
}

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const prevIsValue = () => { const p = toks[toks.length - 1]; return !!p && (p.t === 'num' || p.t === 'rp' || p.t === 'pct'); };
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c) && !(c === '.' && !/\d/.test(s[i + 1] ?? ''))) {
      const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i))!;
      toks.push({ t: 'num', v: parseFloat(m[0]), src: m[0] }); i += m[0].length; continue;
    }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === '%') { toks.push({ t: 'pct' }); i++; continue; }
    if ('+-*/×÷@='.includes(c)) { toks.push({ t: 'op', v: c === '×' || c === '@' ? '*' : c === '÷' ? '/' : c }); i++; continue; }
    if (c === '₹') { toks.push({ t: 'word', v: '₹' }); i++; continue; }
    if (/[A-Za-zऀ-ॿ]/.test(c)) {
      let j = i; while (j < s.length && /[A-Za-zऀ-ॿ]/.test(s[j])) j++;
      const w = s.slice(i, j);
      if ((w === 'x' || w === 'X') && prevIsValue() && /^\s*[\d(.₹]/.test(s.slice(j))) toks.push({ t: 'op', v: '*' });
      else if (w.toLowerCase() === 'of' && toks[toks.length - 1]?.t === 'pct') toks.push({ t: 'of' });
      else toks.push({ t: 'word', v: w });
      i = j; continue;
    }
    toks.push({ t: 'word', v: c }); i++;
  }
  return toks;
}

interface Run { toks: Tok[]; start: number; end: number; hasOp: boolean; hasRupee: boolean; unitAfter: boolean }
/** Maximal stretches of numbers/operators; words break them. */
function runs(toks: Tok[]): Run[] {
  const out: Run[] = [];
  let cur: Tok[] = [], start = 0, rupee = false;
  const flush = (endIdx: number) => {
    // trim operators that cannot start/end an expression (a leading unary minus is fine)
    while (cur.length && cur[cur.length - 1].t === 'op') cur.pop();
    while (cur.length && cur[0].t === 'op' && (cur[0] as any).v !== '-') cur.shift();
    if (cur.some((t) => t.t === 'num')) {
      const next = toks[endIdx];
      out.push({ toks: cur, start, end: endIdx, hasOp: cur.some((t) => t.t === 'op' || t.t === 'of'), hasRupee: rupee,
        unitAfter: !!next && next.t === 'word' && UNITS.has(next.v.toLowerCase()) });
    }
    cur = []; rupee = false;
  };
  toks.forEach((t, i) => {
    if (t.t === 'word') {
      if (t.v === '₹') { if (!cur.length) rupee = true; return; }           // ₹ marks the amount that follows
      flush(i); start = i + 1; return;
    }
    // two values side by side with no operator ("1020 60") are separate candidates, not one expression
    const last = cur[cur.length - 1];
    if (last && (last.t === 'num' || last.t === 'rp' || last.t === 'pct') && (t.t === 'num' || t.t === 'lp')) { flush(i); start = i; }
    if (!cur.length) start = i;
    cur.push(t);
  });
  flush(toks.length);
  return out;
}

class Parser {
  i = 0;
  constructor(private t: Tok[]) {}
  private peek() { return this.t[this.i]; }
  expr(): { v: number; pct: boolean } {
    let left = this.term();
    for (;;) {
      const p = this.peek();
      if (p?.t === 'op' && (p.v === '+' || p.v === '-')) {
        this.i++;
        const right = this.term();
        const delta = right.pct ? (left.v * right.v) : right.v;        // "1500 - 10%" = 10% of 1500
        left = { v: p.v === '+' ? left.v + delta : left.v - delta, pct: false };
      } else return left;
    }
  }
  term(): { v: number; pct: boolean } {
    let left = this.factor();
    for (;;) {
      const p = this.peek();
      if (p?.t === 'op' && (p.v === '*' || p.v === '/')) {
        this.i++;
        const right = this.factor();
        left = { v: p.v === '*' ? left.v * right.v : left.v / right.v, pct: false };
      } else if (p?.t === 'of' && left.pct) { this.i++; left = { v: left.v * this.factor().v, pct: false }; }
      else return left;
    }
  }
  factor(): { v: number; pct: boolean } {
    const p = this.peek();
    if (p?.t === 'op' && p.v === '-') { this.i++; const f = this.factor(); return { v: -f.v, pct: f.pct }; }
    if (p?.t === 'op' && p.v === '+') { this.i++; return this.factor(); }
    if (p?.t === 'lp') { this.i++; const e = this.expr(); if (this.peek()?.t === 'rp') this.i++; return { v: e.v, pct: false }; }
    if (p?.t === 'num') {
      this.i++;
      if (this.peek()?.t === 'pct') { this.i++; return { v: p.v / 100, pct: true }; }
      return { v: p.v, pct: false };
    }
    throw new Error('unexpected');
  }
}

/** Evaluate one run; returns null if it is not a valid expression. */
function evaluate(toks: Tok[]): number | null {
  try {
    const p = new Parser(toks);
    const r = p.expr();
    if (p.i < toks.length) return null;
    return Number.isFinite(r.v) ? r.v : null;
  } catch { return null; }
}
const cents = (v: number) => Math.round(v * 100);

export function calcLine(raw: string): { kind: 'amount' | 'label' | 'error'; value: number | null; hint?: string } {
  const text = raw.trim();
  if (!text || text.startsWith('#') || text.startsWith('//')) return { kind: 'label', value: null };
  let s = normalise(text).replace(/^[-*•]\s+(?=[A-Za-zऀ-ॿ])/, ''); // "- Chai 12" is a bullet, "-200" is a deduction
  // "Milk 2 x 35 = 70": keep what is left of the last "=" (we do the sum ourselves); "Total = 500" keeps the right side.
  const eq = s.lastIndexOf('=');
  if (eq >= 0) { const left = s.slice(0, eq); s = /\d/.test(left) ? left : s.slice(eq + 1); }
  const all = runs(tokenize(s));
  if (!all.length) return { kind: 'label', value: null };
  // quantities ("2 boxes", "60 pcs") are not amounts, unless nothing else is there
  const money = all.filter((r) => !(r.unitAfter && !r.hasOp));
  const pool = money.length ? money : all;
  const pick = pool.find((r) => r.hasOp) ?? pool.find((r) => r.hasRupee) ?? pool[pool.length - 1];
  const v = evaluate(pick.toks);
  if (v === null) return { kind: 'error', value: null, hint: 'Could not work this out' };
  return { kind: 'amount', value: cents(v) / 100 };
}

export function calcNote(text: string): { lines: LineResult[]; total: number } {
  const lines: LineResult[] = [];
  let totalCents = 0, sinceTotal = 0;
  for (const raw of text.split('\n')) {
    if (!raw.trim()) { lines.push({ kind: 'blank', value: null }); continue; }
    if (SUBTOTAL.test(raw.trim())) { lines.push({ kind: 'subtotal', value: sinceTotal / 100 }); sinceTotal = 0; continue; }
    const r = calcLine(raw);
    if (r.kind === 'amount') { const c = cents(r.value!); totalCents += c; sinceTotal += c; }
    lines.push(r);
  }
  return { lines, total: totalCents / 100 };
}
