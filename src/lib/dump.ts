// Reads a messy text dump - WhatsApp messages, a diary page, voice typing - and picks out the money in it:
//
//   aaj gas 820 diya, chai 40, auto 120. Ramesh salary 5000 gpay
//   bijli bill 1450 paid
//   Sharma se 3000 mila
//
// gives expenses Gas 820, Tea 40, Transport 120, Salary 5000 (Ramesh, paid by bank), Electricity 1450,
// and a ₹3,000 collection from Sharma. Totals, balances, phone numbers, times and percentages are skipped.
// Pure (no DOM, no DB): the browser runs it on every keystroke (works offline) and the tests run it too.
import { parseDate, stripDate, findProduct, type ParseContext } from './parser';

export type PayMode = 'cash' | 'bank' | 'credit';
export type CollectMode = 'cash' | 'upi' | 'card' | 'credit';
export interface DumpExpense { category: string; amount: number; notes: string; payment_mode: PayMode; date: string | null; source: string }
export interface DumpPurchase { item: string; product_id: number | null; qty: number; unit: string; pieces: number | null; total: number; payment_mode: PayMode; date: string | null; source: string }
export interface DumpCollection { amount: number; mode: CollectMode; customer: string; date: string | null; source: string }
export interface DumpResult { expenses: DumpExpense[]; purchases: DumpPurchase[]; collections: DumpCollection[]; skipped: string[] }
/** `today` (YYYY-MM-DD) lets "yesterday" / "kal" become a real date. */
export interface DumpContext extends ParseContext { today?: string | null }

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

// Stock units: a number before one of these is a quantity of stock (a purchase), never the price.
const STOCK_UNITS = 'boxes|box|bx|crates?|cartons?|ctns?|cases?|trays?|packs?|packets?|pkts?|dozens?|dz|peti|petis';
const STOCK_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${STOCK_UNITS})\\b`, 'i');
const PCS_RE = /(\d+)\s*(?:pcs|pieces?|pc|nos)\b/i;
// Any word that turns the number before it into a count ("4 cups", "2 kg", "3 din") rather than rupees.
const COUNT = set(`box boxes bx crate crates carton cartons ctn ctns case cases tray trays pack packs packet packets pkt pkts dozen dozens dz peti petis
  kg kgs kilo kilos g gm gms gram grams ltr ltrs litre litres liter liters l ml bottle bottles bag bags pcs pc piece pieces nos unit units
  cup cups plate plates glass glasses item items time times day days din month months mahina mahine hr hrs hour hours km kms
  person persons people log bundle bundles sack sacks tin tins jar jars can cans x × कप किलो दिन`);
// Filler words: verbs, pronouns, connectors, payment words. They are never the "what" of an expense.
const STOP = set(`paid pay pays paying payed spent spend spending gave give given giving diya diye di de dena dene diyaa kharcha kharch kharche kharcha
  kiya kiye kia ki ka ke ko se me mein main maine mai mujhe hum humne humko ne for to on of the a an in at by with and aur or ya also then phir bhi
  today aaj kal yesterday tomorrow morning evening night subah shaam sham raat din abhi
  rs rupees rupee rupaye rupay rupaiye rupiya rupiye inr cash upi gpay phonepe paytm online via through using bank card net neft imps transfer transferred
  amount amt bought buy buying purchased purchase kharida kharide kharidi liya liye li lia le lie got get gets mila mile mili
  was were is are been be it this that these those i we he she they my our his her their us him them me you your
  sir bhai ji bhaiya only just around approx about extra more some new per each every hua hui hue gaya gayi gaye laga lagi lage lagaya deke karke kar
  done did hai hain tha thi the wala wali wale hisaab hisab hisaab: note notes expense expenses daily
  का की के को से ने में मैंने आज कल दिया दिए दिये रुपये रुपए रु और भी`);
const GENERIC = set('bill bills charge charges fee fees payment kharcha cost expense');

const SKIP = set('total subtotal grand balance bal opening closing bacha bache bachi remaining left refund refunded returned return wapas vapas कुल बाकी');
const COLLECT = set(`received recieved receive recd rcvd collection collected collect sale sales sold bikri becha bechi beche galla gallah
  mila mile mili milaa income earned aaya aaye aayi aya deposit deposited मिला मिले बिक्री आया`);
const BUY = set('bought buy buying purchase purchased kharida kharide kharidi liya liye lia maal stock खरीदा लिया');
const BANK = set('upi gpay googlepay phonepe paytm online bank neft imps rtgs transfer transferred cheque');
const CARD = set('card');
const CREDIT = set('udhaar udhar udhari credit उधार');

// Common running costs of an Indian shop. If the shop already has a category with one of these names, that one is used.
const GROUPS: [string, string[]][] = [
  ['Gas', ['gas', 'cylinder', 'lpg', 'silinder', 'गैस']],
  ['Electricity', ['electricity', 'bijli', 'light bill', 'current bill', 'eb bill', 'power bill', 'electric', 'बिजली']],
  ['Wi-Fi', ['wifi', 'wi fi', 'internet', 'broadband', 'fiber', 'fibre']],
  ['Phone recharge', ['recharge', 'mobile bill', 'phone bill']],
  ['Water', ['water', 'paani', 'pani', 'water can', 'bisleri', 'पानी']],
  ['Rent', ['rent', 'kiraya', 'kiraaya', 'किराया']],
  ['Salary', ['salary', 'salaries', 'pagar', 'wages', 'wage', 'tankha', 'tankhwah', 'mazdoori', 'majdoori', 'labour', 'labor', 'helper', 'staff', 'सैलरी', 'तनख्वाह']],
  ['Tea & snacks', ['tea', 'chai', 'coffee', 'nashta', 'snacks', 'snack', 'samosa', 'biscuit', 'biscuits', 'lunch', 'dinner', 'breakfast', 'khana', 'food', 'meal', 'चाय', 'नाश्ता', 'खाना']],
  ['Transport', ['auto', 'rickshaw', 'petrol', 'diesel', 'fuel', 'taxi', 'cab', 'ola', 'uber', 'rapido', 'bus', 'train', 'metro', 'tempo', 'fare', 'bhada', 'bhaada', 'transport', 'delivery', 'courier', 'parking', 'toll', 'gaadi', 'gadi', 'ऑटो', 'पेट्रोल', 'भाड़ा']],
  ['Repairs', ['repair', 'repairs', 'maintenance', 'mistri', 'plumber', 'electrician', 'servicing', 'service']],
  ['Ice', ['ice', 'barf', 'baraf', 'बर्फ']],
  ['Packing', ['polythene', 'polybag', 'polybags', 'carry bag', 'carry bags', 'packing', 'packaging', 'tape', 'thaili', 'thaila']],
  ['Cleaning', ['cleaning', 'safai', 'broom', 'jhadu', 'jhaadu', 'phenyl', 'sweeper', 'detergent']],
  ['Stationery', ['stationery', 'pen', 'register', 'printout', 'xerox', 'photocopy']],
  ['Medical', ['medicine', 'medicines', 'dawai', 'dawa', 'doctor', 'medical', 'hospital', 'दवाई']],
  ['Donation', ['donation', 'chanda', 'daan', 'mandir', 'temple', 'masjid', 'gurudwara']],
  ['Loan EMI', ['emi', 'loan', 'kist', 'installment', 'instalment']],
  ['Bank charges', ['bank charges', 'interest', 'byaj']],
  ['Tax', ['gst', 'tax', 'taxes']],
];

const NUM = '\\d+(?:\\.\\d+)?';
const DOT = '․'; // stands in for a decimal point while sentences are split on "."
const round2 = (n: number) => Math.round(n * 100) / 100;
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]/g, '');
const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase()).slice(0, 60);
/** Words of a phrase: Latin or Devanagari letters only, lower-cased. */
const wordsOf = (s: string): string[] => (s.toLowerCase().match(/[a-zऀ-ॿ]+/g) ?? []);
const hasAny = (words: string[], dict: Set<string>) => words.some((w) => dict.has(w));

function normalise(text: string): string {
  let s = text
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/[​-‍﻿]/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/\|/g, ' ')
    .replace(/\d{13,}/g, ' ')                                                                   // not money; long digit runs also slow the scans
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1')                                                      // 1,020 and 1,00,000
    .replace(/(?:₹|\brs\.?|\binr\b|\brupees?\b|रु\.?)\s*(?=\d)/gi, '₹')                         // ₹ 500, Rs. 500, INR 500
    .replace(new RegExp(`(${NUM})\\s*(?:\\/-|₹|rs\\b|rupees?\\b|rupaye\\b|rupay\\b|rupaiye\\b|rupiya\\b|rupiye\\b|रुपये|रुपए)`, 'gi'), '₹$1') // 500/-, 500rs, 500 rupees
    .replace(new RegExp(`(${NUM})\\s*(?:k|hazar|hazaar|hajar|thousand|हजार)(?![a-z])`, 'gi'), (_, n) => String(round2(Number(n) * 1000)))
    .replace(new RegExp(`(${NUM})\\s*(?:lakh|lakhs|lac|लाख)(?![a-z])`, 'gi'), (_, n) => String(round2(Number(n) * 100000)));
  // "500 + 200" is one amount
  const add = new RegExp(`(₹?)(${NUM})\\s*\\+\\s*₹?(${NUM})`);
  for (let i = 0; i < 20 && add.test(s); i++) s = s.replace(add, (_, r, a, b) => `${r}${round2(Number(a) + Number(b))}`);
  return s;
}

/** Bits with no words of their own ("1020", "60 pcs", "paid 500") belong to the clause before them. */
function isFragment(part: string): boolean {
  if (!/\d/.test(part)) return false;
  return wordsOf(part).every((w) => STOP.has(w) || COUNT.has(w));
}
const isLabelWord = (t: string) => /[a-zऀ-ॿ]/i.test(t) && !STOP.has(t.toLowerCase()) && !COUNT.has(t.toLowerCase());
const isNumTok = (t: string) => /^₹?\d/.test(t);

const AFTER = set('diya diye di mila mile mili aaya aaye paid');
/** "gas 820 chai 40 auto 120" → three clauses. Anything that is not a clean label-amount list stays whole. */
function splitPairs(part: string): string[] {
  const toks = part.match(/₹?\d+(?:[.․]\d+)?|[^\s\d₹]+/g) ?? [];
  const groups: string[][] = [];
  let cur: string[] = [], labelled = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!isNumTok(t)) {
      if (!cur.length && groups.length && AFTER.has(t.toLowerCase())) { groups[groups.length - 1].push(t); continue; } // "400 diye Pappu ne 300"
      cur.push(t); if (isLabelWord(t)) labelled = true; continue;
    }
    const next = (toks[i + 1] ?? '').toLowerCase(), prev = (toks[i - 1] ?? '').toLowerCase();
    if (COUNT.has(next) || /^[x×*=]/.test(next) || /[x×*=]$/.test(prev) || !labelled) return [part];
    cur.push(t); groups.push(cur); cur = []; labelled = false;
  }
  if (groups.length < 2) return [part];
  if (cur.length) { if (labelled) return [part]; groups[groups.length - 1].push(...cur); } // trailing "diya" joins the last pair
  return groups.map((g) => g.join(' '));
}

function splitClauses(text: string): string[] {
  const out: string[] = [];
  const t = text.replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
  for (const line of t.split(/\r?\n|;|•/)) {
    for (const sentence of line.split(/[.!?।]+/)) {
      const parts: string[] = [];
      for (const p of sentence.split(/,|\s+(?:and|aur|evam|then|phir|also|plus|&|\+)\s+|\s&\s/i)) {
        const part = p.trim();
        if (!part) continue;
        if (parts.length && isFragment(part)) parts[parts.length - 1] += ' ' + part; else parts.push(part);
      }
      for (const p of parts) for (const c of splitPairs(p)) out.push(c.split(DOT).join('.').trim());
    }
  }
  return out.filter(Boolean);
}

/** The rupee amount in a clause: "= 40" wins, then "₹500", then "4 x 10", then any number that is not a count; largest last. */
function amountOf(s: string): number | null {
  const eq = s.match(new RegExp(`=\\s*₹?\\s*(${NUM})`));
  if (eq) return round2(Number(eq[1]));
  const marked = s.match(new RegExp(`₹\\s*(${NUM})`));
  if (marked) return round2(Number(marked[1]));
  const mul = s.match(new RegExp(`(${NUM})\\s*[x×*]\\s*(${NUM})`, 'i'));
  if (mul) return round2(Number(mul[1]) * Number(mul[2]));
  const free: number[] = [];
  for (const m of s.matchAll(new RegExp(`(${NUM})\\s*([a-zऀ-ॿ×]+)?`, 'gi'))) if (!m[2] || !COUNT.has(m[2].toLowerCase())) free.push(Number(m[1]));
  const best = free.length ? Math.max(...free) : 0;
  return best > 0 ? round2(best) : null;
}

/** What the money was for: the clause without amounts, counts and filler words (original spelling kept). */
function labelWords(s: string): string[] {
  const cleaned = s
    .replace(new RegExp(`₹\\s*${NUM}`, 'g'), ' ')
    .replace(new RegExp(`${NUM}\\s*[x×*]\\s*${NUM}`, 'gi'), ' ')
    .replace(new RegExp(`${NUM}\\s*([a-zऀ-ॿ]+)`, 'gi'), (m, w) => (COUNT.has(w.toLowerCase()) ? ' ' : ' ' + w))
    .replace(/\d+(?:\.\d+)?/g, ' ');
  return (cleaned.match(/[A-Za-zऀ-ॿ]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()) && !COUNT.has(w.toLowerCase()));
}

// Compacted once: resolveCategory runs for every clause of a long note.
const GROUPS_C = GROUPS.map(([name, keys]) => ({ name, keys, entries: keys.map((key) => ({ kk: compact(key), len: key.split(' ').length })), names: new Set([name, ...keys].map(compact)) }));
const compactCache = new Map<string, string>();
const compactC = (s: string) => { let v = compactCache.get(s); if (v === undefined) { v = compact(s); if (compactCache.size > 500) compactCache.clear(); compactCache.set(s, v); } return v; };

let lastCats: string[] | null = null, lastSorted: string[] = [];
const sortedCategories = (cats: string[]) => (cats === lastCats ? lastSorted : (lastCats = cats, lastSorted = [...cats].sort((a, b) => b.length - a.length)));

/** Pick the category: one the shop already has, else a common one by keyword, else the words themselves. */
function resolveCategory(label: string[], categories: string[]): { category: string; notes: string } {
  const low = label.map((w) => w.toLowerCase());
  const windows: { from: number; len: number; key: string }[] = [];
  for (let i = 0; i < low.length; i++) for (let n = 1; n <= 3 && i + n <= low.length; n++) windows.push({ from: i, len: n, key: compactC(low.slice(i, i + n).join('')) });
  const rest = (from: number, len: number) => label.filter((w, i) => (i < from || i >= from + len) && !GENERIC.has(w.toLowerCase())).join(' ');

  for (const c of sortedCategories(categories)) {
    const k = compactC(c); if (k.length < 2) continue;
    const hit = windows.find((w) => w.key === k);
    if (hit) return { category: c, notes: rest(hit.from, hit.len) };
  }
  let best: { name: string; keys: string[]; from: number; len: number } | null = null;
  for (const { name, keys, entries } of GROUPS_C) {
    for (const { kk, len } of entries) {
      const hit = windows.find((w) => w.len === len && w.key === kk);
      if (hit && (!best || hit.from < best.from || (hit.from === best.from && hit.len > best.len))) best = { name, keys, from: hit.from, len: hit.len };
    }
  }
  if (best) {
    const names = GROUPS_C.find((g) => g.name === best!.name)!.names;
    const known = categories.find((c) => names.has(compactC(c)));
    return { category: known ?? best.name, notes: rest(best.from, best.len) };
  }
  const meaningful = label.filter((w) => !GENERIC.has(w.toLowerCase()));
  return { category: titleCase((meaningful.length ? meaningful : label).slice(0, 3).join(' ')), notes: '' };
}

function matchProduct(s: string, products: ParseContext['products']) {
  const words = wordsOf(s);
  for (const p of [...products].sort((a, b) => b.name.length - a.name.length)) {
    const k = compact(p.name); if (k.length < 3) continue;
    for (let i = 0; i < words.length; i++) for (let n = 1; n <= 3 && i + n <= words.length; n++) if (compact(words.slice(i, i + n).join('')) === k) return p;
  }
  return null;
}
const normUnit = (u: string) => {
  const l = u.toLowerCase();
  if (l.startsWith('b')) return 'box';
  if (l.startsWith('cr')) return 'crate';
  if (l.startsWith('car') || l.startsWith('ctn')) return 'carton';
  if (l.startsWith('cas')) return 'case';
  if (l.startsWith('tr')) return 'tray';
  if (l.startsWith('p') && l !== 'peti' && l !== 'petis') return 'pack';
  if (l.startsWith('d')) return 'dozen';
  return 'box'; // peti = a box
};
const payMode = (w: string[]): PayMode => (hasAny(w, CREDIT) ? 'credit' : hasAny(w, BANK) || hasAny(w, CARD) ? 'bank' : 'cash');
const collectMode = (w: string[]): CollectMode => (hasAny(w, CREDIT) ? 'credit' : hasAny(w, CARD) ? 'card' : hasAny(w, BANK) ? 'upi' : 'cash');
function customerOf(s: string): string {
  const from = s.match(/\bfrom\s+([A-Za-z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)?)/);
  if (from && !STOP.has(from[1].toLowerCase())) return from[1];
  const se = s.match(/\b([A-Za-z][A-Za-z.]+)\s+(?:se|ne)\b/i);
  return se && !STOP.has(se[1].toLowerCase()) && !COLLECT.has(se[1].toLowerCase()) ? se[1] : '';
}
function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

export function readDump(text: string, ctx: DumpContext): DumpResult {
  const out: DumpResult = { expenses: [], purchases: [], collections: [], skipped: [] };
  let carried: string | null = null; // a date written on its own line applies to the lines after it
  for (const source of splitClauses(normalise(String(text).slice(0, 20000)))) {
    let s = source;
    let date = carried;
    const d = parseDate(s, ctx.defaultYear);
    if (d) { date = carried = d; s = stripDate(s); }
    const w0 = wordsOf(s);
    if (w0.includes('today') || w0.includes('aaj') || w0.includes('आज')) { if (!d) date = carried = null; }
    if ((w0.includes('yesterday') || w0.includes('kal') || w0.includes('कल')) && ctx.today && !d) date = addDays(ctx.today, -1);
    s = s
      .replace(/\+91[\s-]?\d{5}[\s-]?\d{5}\b|\b\d{10,}\b/g, ' ')                                                     // phone numbers
      .replace(/\b\d{1,2}:\d{2}(?:\s*(?:am|pm))?\b|\b\d{1,2}(?:\.\d{2})?\s*(?:am|pm)\b/gi, ' ')            // times
      .replace(/\d+(?:\.\d+)?\s*%/g, ' ')                                                                  // percentages
      .replace(/\b\d+(?:st|nd|rd|th)\b/gi, ' ');                                                           // 2nd, 3rd
    if (!/\d/.test(s)) continue; // plain words: nothing to take
    const w = wordsOf(s);

    if (hasAny(w, SKIP)) { out.skipped.push(source); continue; }

    const collected = hasAny(w, COLLECT) || /\bne\s+(?:udhaar|udhar|udhari)\b/i.test(s) || /\bgot\b.*\bfrom\b/i.test(s) || /\bpaid\s+(?:me|us)\b/i.test(s)
      || /\b[a-z]+\s+ne\s+(?:\S+\s+){0,3}(?:diye|diya|di)\b/i.test(s)
      // "Raju udhaar 450": a name on udhaar is a sale on credit, unless it is plainly stock or a bill we paid
      || (hasAny(w, CREDIT) && !hasAny(w, BUY) && !STOCK_RE.test(s) && !/\b(?:paid|pay|diya|diye|gave)\b/i.test(s));
    if (collected) {
      const amount = amountOf(s);
      const mode = collectMode(w);
      // udhaar needs a name: "Raju udhaar 300 sale" → Raju
      const customer = customerOf(s) || (mode === 'credit' ? labelWords(s).find((x) => !COLLECT.has(x.toLowerCase()) && !CREDIT.has(x.toLowerCase())) ?? '' : '');
      if (amount) out.collections.push({ amount, mode, customer, date, source });
      else out.skipped.push(source);
      continue;
    }

    const stock = s.match(STOCK_RE);
    const prod = matchProduct(s, ctx.products);
    if (stock || (prod && hasAny(w, BUY))) {
      let rest = stock ? s.replace(stock[0], ' ') : s;
      const pm = rest.match(PCS_RE);
      let pieces: number | null = pm ? Number(pm[1]) : null;
      if (pm) rest = rest.replace(pm[0], ' ');
      const total = amountOf(rest);
      const product = prod ?? findProduct(labelWords(rest).join(' '), ctx.products);
      const item = product?.name ?? titleCase(labelWords(rest).join(' '));
      const qty = stock ? Number(stock[1]) : 1;
      if (pieces === null && total) { // "Sting 2 boxes 1020 60": the number that is not the price is the pieces
        const others = [...rest.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((n) => n !== total && Number.isInteger(n));
        if (others.length) pieces = others[others.length - 1];
      }
      if (pieces === null && product) pieces = Math.round(qty * product.pieces_per_unit);
      if (total && item) {
        out.purchases.push({ item, product_id: product?.id ?? null, qty, unit: stock ? normUnit(stock[2]) : 'box', pieces, total, payment_mode: payMode(w), date, source });
        continue;
      }
    }

    const amount = amountOf(s);
    const label = labelWords(s);
    if (!amount || !label.length) { out.skipped.push(source); continue; }
    const { category, notes } = resolveCategory(label, ctx.categories);
    out.expenses.push({ category, amount, notes, payment_mode: payMode(w), date, source });
  }
  return out;
}
