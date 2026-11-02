// Receipt templates and the shop's receipt choices on this device (localStorage dk_receipt: { tpl, thanks }).
// Pure (no DOM) so test/receipt.test.ts can check it; receipt.js draws the templates.

export const TEMPLATES = [
  { id: 'classic', name: 'Classic', desc: 'Torn paper slip in your colour' },
  { id: 'thermal', name: 'Shop printer', desc: 'Looks like a printed till slip' },
  { id: 'paper', name: 'Paper & ink', desc: 'Oat paper, serif, dotted lines' },
  { id: 'modern', name: 'Modern', desc: 'Clean card with a colour band' },
  { id: 'invoice', name: 'Invoice', desc: 'Formal: item table and signature' },
  { id: 'bold', name: 'Bold', desc: 'The total first, big, on your colour' },
];

export const DEFAULT_THANKS = 'Thank you, visit again!';
const KEY = 'dk_receipt';
const MAX_THANKS = 80;

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

/** Always returns something usable, whatever is (or isn't) saved. thanks '' means "no thank-you line". */
export function readReceiptPrefs(storage = globalThis.localStorage) {
  let raw = null;
  try { raw = JSON.parse(storage?.getItem(KEY) || 'null'); } catch { raw = null; }
  const thanks = typeof raw?.thanks === 'string' ? cleanThanks(raw.thanks) : DEFAULT_THANKS;
  return { tpl: templateById(raw?.tpl).id, thanks };
}

export function writeReceiptPrefs(prefs, storage = globalThis.localStorage) {
  const next = { tpl: templateById(prefs.tpl).id, thanks: cleanThanks(prefs.thanks ?? DEFAULT_THANKS) };
  try { storage?.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked: lasts until reload */ }
  return next;
}

/** One line, no control characters, not too long for the paper. */
export function cleanThanks(s) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_THANKS);
}

/** The line at the bottom: an explicit footer wins; otherwise the payment status plus the shop's thank-you line. */
export function footerFor(opts, prefs) {
  if (opts.footer) return opts.footer;
  return [opts.status, opts.thanks ? prefs.thanks : ''].filter(Boolean).join(' · ');
}

/** Bill items carry qty and rate for the Invoice table; everything else is a plain label / amount line. */
export const hasTable = (lines) => lines.some((l) => l.qty != null && l.rate != null);

/** A small, stable pseudo-random sequence from a string (bar widths of the printer template's code strip). */
export function stripeWidths(seed, n = 46) {
  let x = 2166136261;
  for (const ch of String(seed)) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619) >>> 0; }
  const out = [];
  for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out.push(1 + (x % 4)); }
  return out;
}
