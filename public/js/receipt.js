// Receipt images: draws a receipt on a canvas in one of several templates (receiptprefs.js) and shares it the way a
// phone expects: the share sheet (WhatsApp, Instagram, Messages…) with the picture attached.
// Each template = a page (background + paper shape) and a compose() that lays out measured blocks top to bottom.
import { locale, t as tx } from './i18n.js';
import { h, mount, icon, modal, toast } from './ui.js';
import { logoImage } from './brandicon.js';
import { TEMPLATES, templateById, readReceiptPrefs, writeReceiptPrefs, footerFor, hasTable, stripeWidths, DEFAULT_THANKS } from './receiptprefs.js';

const prefsNow = () => { const p = readReceiptPrefs(); return p.thanks === DEFAULT_THANKS ? { ...p, thanks: tx(DEFAULT_THANKS) } : p; };

const SANS = '"Palanquin", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif';
const SERIF = '"Eczar", "Iowan Old Style", Georgia, "Noto Serif Devanagari", serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "Courier New", monospace';
const SCALE = 2;
const MAX_PIXELS = 16e6; // iOS Safari refuses bigger canvases; very long receipts are drawn at a lower scale instead

const fnt = (family) => (w, px, style = '') => `${style ? style + ' ' : ''}${w} ${px}px ${family}`;
const sans = fnt(SANS), serif = fnt(SERIF), mono = fnt(MONO);

function wrap(ctx, text, maxW) {
  const out = []; let cur = '';
  for (const word of String(text).split(/\s+/)) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(t).width > maxW) { out.push(cur); cur = word; } else cur = t;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

function drawRule(ctx, kind, color, x0, x1, y) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round';
  const line = (yy, w, dash) => { ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); };
  if (kind === 'dashed') line(y, 1.5, [6, 5]);
  else if (kind === 'dots') line(y, 2, [0.1, 5]);
  else if (kind === 'double') { line(y - 2, 1.2, []); line(y + 2, 1.2, []); }
  else line(y, kind === 'thick' ? 2 : 1, []);
  ctx.restore();
}

function rounded(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, hgt, r); else ctx.rect(x, y, w, hgt);
}

/** Company logo (or its first letter on the brand colour) in a circle or rounded square. */
function drawMark(ctx, d, cx, cy, r, { square = false, onBrand = false } = {}) {
  ctx.save();
  if (square) rounded(ctx, cx - r, cy - r, r * 2, r * 2, Math.round(r * 0.5)); else { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
  ctx.closePath();
  if (d.logo) {
    ctx.clip(); ctx.fillStyle = '#ffffff'; ctx.fill();
    const lw = d.logo.naturalWidth || d.logo.width, lh = d.logo.naturalHeight || d.logo.height, k = Math.min((r * 2) / lw, (r * 2) / lh);
    ctx.drawImage(d.logo, cx - (lw * k) / 2, cy - (lh * k) / 2, lw * k, lh * k);
  } else {
    ctx.fillStyle = onBrand ? '#ffffff' : d.brand; ctx.fill();
    ctx.fillStyle = onBrand ? d.brand : '#ffffff'; ctx.font = sans(800, Math.round(r * 0.95)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((d.company?.name || 'D')[0].toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
}

/** Blocks with a measured height, drawn later at their y. x positions are inside the paper (0 = paper's left edge). */
function makeLayout(page) {
  const probe = document.createElement('canvas').getContext('2d');
  const items = [];
  const inner = page.W - page.margin * 2 - page.pad * 2, X = page.pad;
  const L = {
    inner, X, items,
    gap(px) { items.push({ h: px, draw() {} }); },
    add(hgt, draw) { items.push({ h: hgt, draw }); },
    wrapText(str, f, maxW = inner) { probe.font = f; return wrap(probe, str, maxW); },
    width(str, f) { probe.font = f; return probe.measureText(str).width; },
    text(str, f, color, align = 'left', lh = 20, maxW = inner) {
      const ls = L.wrapText(str, f, maxW);
      L.add(ls.length * lh, (ctx, y) => {
        ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
        const x = align === 'center' ? X + inner / 2 : align === 'right' ? X + inner : X;
        ls.forEach((l, i) => ctx.fillText(l, x, y + lh * (i + 0.76)));
      });
    },
    rule(kind, color, hgt = 18) { L.add(hgt, (ctx, y) => drawRule(ctx, kind, color, X, X + inner, y + hgt / 2)); },
  };
  return L;
}

/** Title on the left, date and time on the right (wraps the title if it is long). */
function titleRow(L, d, { f, color, whenF, muted, upper = false }) {
  const title = upper ? String(d.title).toUpperCase() : d.title;
  const whenW = L.width(d.when, whenF);
  const tl = L.wrapText(title, f, L.inner - whenW - 16);
  const lh = Math.round(parseFloat(f.match(/(\d+)px/)[1]) * 1.34);
  L.add(tl.length * lh, (ctx, y) => {
    ctx.textBaseline = 'alphabetic'; ctx.font = f; ctx.fillStyle = color; ctx.textAlign = 'left';
    tl.forEach((l, i) => ctx.fillText(l, L.X, y + lh * (i + 0.76)));
    ctx.font = whenF; ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(d.when, L.X + L.inner, y + lh * 0.76);
  });
}

/** Label … value rows (bills, cash counts, notes). S: font, size, lh, ink, muted, neg, subRule?, leader?, sep?, valueW? */
function lineRows(L, lines, S) {
  const valueW = S.valueW ?? 150, size = S.size ?? 15, lh = S.lh ?? 22;
  for (const ln of lines) {
    if (ln.kind === 'heading') { L.gap(6); L.text(S.headUpper === false ? ln.label : String(ln.label).toUpperCase(), S.font(700, Math.max(11, size - 3)), S.muted, 'left', 18); continue; }
    const bold = ln.kind === 'sub';
    const f = S.font(bold ? 700 : (S.weight ?? 500), size);
    const vf = S.font(bold ? 750 : (S.valueWeight ?? 650), size);
    const ls = L.wrapText(ln.label, f, ln.value ? L.inner - valueW - 12 : L.inner);
    const noteH = ln.note ? 17 : 0;
    L.add(ls.length * lh + noteH + 8, (ctx, y) => {
      if (bold && S.subRule) drawRule(ctx, 'solid', S.subRule, L.X, L.X + L.inner, y + 1);
      ctx.textBaseline = 'alphabetic'; ctx.font = f; ctx.fillStyle = ln.kind === 'muted' ? S.muted : S.ink; ctx.textAlign = 'left';
      ls.forEach((l, i) => ctx.fillText(l, L.X, y + 4 + lh * (i + 0.78)));
      if (ln.note) { ctx.font = S.font(500, Math.max(11, size - 3), S.noteStyle); ctx.fillStyle = S.muted; ctx.fillText(ln.note, L.X, y + 4 + ls.length * lh + 11); }
      if (ln.value) {
        ctx.font = vf; ctx.fillStyle = ln.negative ? S.neg : S.ink; ctx.textAlign = 'right';
        const vy = y + 4 + lh * 0.78;
        ctx.fillText(ln.value, L.X + L.inner, vy);
        if (S.leader) { // dotted leader from the end of the first label line to the amount
          ctx.font = f; const a = L.X + ctx.measureText(ls[0]).width + 8; ctx.font = vf; const b = L.X + L.inner - ctx.measureText(ln.value).width - 8;
          if (b - a > 16) drawRule(ctx, 'dots', S.leader, a, b, vy - 4);
        }
      }
      if (S.sep) drawRule(ctx, 'solid', S.sep, L.X, L.X + L.inner, y + ls.length * lh + noteH + 8);
    });
  }
}

// ---------- templates ----------
const PAGES = {
  classic: {
    W: 640, margin: 28, pad: 34, shape: 'torn', paper: '#ffffff', shadow: 'rgba(16,24,48,.22)',
    bg(ctx, W, H) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#eceff7'); g.addColorStop(1, '#dfe4f1'); return g; },
    compose(L, d) {
      const ink = '#0b1020', muted = '#7d869c';
      L.gap(30); L.add(66, (ctx, y) => drawMark(ctx, d, L.X + L.inner / 2, y + 30, 30, { square: !!d.logo })); L.gap(10);
      if (d.company?.name) L.text(d.company.name, sans(750, 24), ink, 'center', 30);
      if (d.contact) L.text(d.contact, sans(500, 13), muted, 'center', 18);
      if (d.company?.gstin) L.text(`GSTIN ${d.company.gstin}`, sans(500, 12), muted, 'center', 17);
      L.gap(14); L.rule('dashed', '#c4cad9'); L.gap(8);
      titleRow(L, d, { f: sans(750, 18), color: ink, whenF: sans(500, 13), muted });
      if (d.subtitle) L.text(d.subtitle, sans(500, 13), muted, 'left', 18);
      L.gap(10);
      lineRows(L, d.lines, { font: sans, ink, muted, neg: '#c42631', subRule: '#e1e5ee' });
      L.gap(8); L.rule('dashed', '#c4cad9'); L.gap(6);
      L.text(d.totalLabel, sans(700, 12), muted, 'center', 20);
      L.add(54, (ctx, y) => { ctx.font = sans(800, 42); ctx.fillStyle = d.brand; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(d.total, L.X + L.inner / 2, y + 42); });
      if (d.words) L.text(d.words, sans(500, 14), '#465069', 'center', 20);
      L.gap(18);
      if (d.footer) { L.text(d.footer, sans(500, 13), muted, 'center', 19); L.gap(6); }
      L.gap(30);
    },
  },
  thermal: {
    W: 480, margin: 24, pad: 26, shape: 'torn-bottom', paper: '#fffef9', shadow: 'rgba(0,0,0,.18)',
    bg: () => '#d8d5ce',
    compose(L, d) {
      const ink = '#111111', muted = '#3d3d3d';
      L.gap(24);
      L.text(String(d.company?.name || 'Receipt').toUpperCase(), mono(800, 22), ink, 'center', 28);
      if (d.contact) L.text(d.contact, mono(400, 12), muted, 'center', 17);
      if (d.company?.gstin) L.text(`GSTIN ${d.company.gstin}`, mono(400, 12), muted, 'center', 17);
      L.gap(8); L.rule('dashed', ink);
      titleRow(L, d, { f: mono(700, 15), color: ink, whenF: mono(400, 12), muted, upper: true });
      if (d.subtitle) L.text(d.subtitle, mono(400, 12), muted, 'left', 17);
      L.rule('dashed', ink);
      lineRows(L, d.lines, { font: mono, size: 14, lh: 20, ink, muted, neg: ink, subRule: ink, valueW: 130, weight: 400, valueWeight: 700 });
      L.rule('double', ink, 16);
      L.add(40, (ctx, y) => {
        ctx.textBaseline = 'alphabetic'; ctx.fillStyle = ink;
        ctx.font = mono(800, 17); ctx.textAlign = 'left'; ctx.fillText(String(d.totalLabel).toUpperCase(), L.X, y + 28);
        ctx.font = mono(800, 26); ctx.textAlign = 'right'; ctx.fillText(d.total, L.X + L.inner, y + 30);
      });
      if (d.words) L.text(d.words, mono(400, 12), muted, 'center', 17);
      L.rule('dashed', ink);
      if (d.footer) L.text(d.footer, mono(400, 12), ink, 'center', 17);
      L.gap(12);
      const bars = stripeWidths(`${d.title}|${d.total}|${d.when}`);
      L.add(48, (ctx, y) => { // decorative code strip, like the bottom of a till slip
        const total = bars.reduce((s, w, i) => s + w + (i % 2 ? 0 : 1), 0) * 2; let x = L.X + (L.inner - total) / 2;
        ctx.fillStyle = ink; bars.forEach((w, i) => { if (i % 2 === 0) ctx.fillRect(x, y, w * 2, 40); x += w * 2 + (i % 2 ? 0 : 2); });
      });
      L.gap(30);
    },
  },
  paper: {
    W: 640, margin: 30, pad: 36, shape: 'torn-bottom', paper: '#fbf8f0', shadow: 'rgba(28,26,43,.30)',
    bg: () => '#f1ebdd',
    compose(L, d) {
      const ink = '#1c1a2b', muted = '#5f5a72', brick = '#a9372d', line = '#d9d0ba';
      L.gap(32);
      if (d.company?.name) L.text(d.company.name, serif(400, 32), ink, 'left', 38);
      if (d.contact) L.text(d.contact, sans(500, 13), muted, 'left', 19);
      if (d.company?.gstin) L.text(`GSTIN ${d.company.gstin}`, sans(500, 12), muted, 'left', 17);
      L.gap(16); L.rule('dashed', line); L.gap(2);
      titleRow(L, d, { f: sans(700, 13), color: ink, whenF: sans(500, 12), muted, upper: true });
      if (d.subtitle) L.text(d.subtitle, sans(500, 14, 'italic'), muted, 'left', 20);
      L.gap(4); L.rule('dashed', line); L.gap(4);
      lineRows(L, d.lines, { font: sans, size: 16, lh: 24, ink, muted, neg: brick, leader: '#cdc4ae', subRule: line, noteStyle: 'italic', valueWeight: 600 });
      L.gap(6); L.rule('dashed', line); L.gap(4);
      L.add(58, (ctx, y) => {
        ctx.textBaseline = 'alphabetic'; ctx.font = sans(600, 14); ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.fillText(d.totalLabel, L.X, y + 40);
        ctx.font = serif(700, 40); ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.fillText(d.total, L.X + L.inner, y + 44);
      });
      if (d.words) L.text(d.words, sans(500, 14, 'italic'), brick, 'left', 20);
      L.gap(20);
      if (d.footer) L.text(d.footer, sans(500, 13), muted, 'center', 19);
      L.gap(40);
    },
  },
  modern: {
    W: 640, margin: 28, pad: 32, shape: 'round', radius: 28, paper: '#ffffff', shadow: 'rgba(16,24,48,.16)',
    bg: () => '#eef0f5',
    compose(L, d) {
      const ink = '#0b1020', muted = '#6b7489';
      const nameF = sans(750, 24), cF = sans(500, 13);
      const textW = L.inner - 72;
      const nl = L.wrapText(d.company?.name || '', nameF, textW), cl = d.contact ? L.wrapText(d.contact, cF, textW) : [];
      const bandH = Math.max(128, 44 + nl.length * 30 + cl.length * 18 + 30);
      L.add(bandH, (ctx, y) => {
        const W = L.inner + L.X * 2;
        ctx.save(); ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(0, y - 4, W, bandH + 4, [28, 28, 0, 0]); else ctx.rect(0, y - 4, W, bandH + 4);
        ctx.fillStyle = d.brand; ctx.fill(); ctx.restore();
        drawMark(ctx, d, L.X + 26, y + bandH / 2, 26, { square: true, onBrand: true });
        let ty = y + (bandH - (nl.length * 30 + cl.length * 18)) / 2;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.font = nameF; ctx.fillStyle = '#ffffff'; nl.forEach((l) => { ctx.fillText(l, L.X + 72, ty + 23); ty += 30; });
        ctx.font = cF; ctx.fillStyle = 'rgba(255,255,255,.86)'; cl.forEach((l) => { ctx.fillText(l, L.X + 72, ty + 14); ty += 18; });
      });
      L.gap(22);
      titleRow(L, d, { f: sans(750, 20), color: ink, whenF: sans(500, 13), muted });
      if (d.subtitle) L.text(d.subtitle, sans(500, 14), muted, 'left', 20);
      if (d.company?.gstin) L.text(`GSTIN ${d.company.gstin}`, sans(500, 12), muted, 'left', 17);
      L.gap(12);
      lineRows(L, d.lines, { font: sans, ink, muted, neg: '#c42631', sep: '#eef0f5' });
      L.gap(14);
      const wl = d.words ? L.wrapText(d.words, sans(500, 13), L.inner - 36) : [];
      const boxH = 70 + wl.length * 18 + (wl.length ? 8 : 0);
      L.add(boxH, (ctx, y) => {
        ctx.save(); rounded(ctx, L.X, y, L.inner, boxH, 18); ctx.fillStyle = d.brand; ctx.globalAlpha = 0.09; ctx.fill(); ctx.restore();
        ctx.textBaseline = 'alphabetic'; ctx.font = sans(700, 12); ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.fillText(String(d.totalLabel).toUpperCase(), L.X + 18, y + 40);
        ctx.font = sans(800, 34); ctx.fillStyle = d.brand; ctx.textAlign = 'right'; ctx.fillText(d.total, L.X + L.inner - 18, y + 46);
        ctx.font = sans(500, 13); ctx.fillStyle = '#465069'; ctx.textAlign = 'left'; wl.forEach((l, i) => ctx.fillText(l, L.X + 18, y + 70 + i * 18));
      });
      L.gap(18);
      if (d.footer) L.text(d.footer, sans(500, 13), muted, 'center', 19);
      L.gap(26);
    },
  },
  invoice: {
    W: 760, margin: 28, pad: 40, shape: 'square', paper: '#ffffff', border: '#d7dbe3', shadow: 'rgba(16,24,48,.12)',
    bg: () => '#e9ebf0',
    compose(L, d) {
      const ink = '#0b1020', muted = '#6b7489', rule = '#d7dbe3', soft = '#e6e8ee';
      L.gap(36);
      // header: logo + shop on the left, title + date on the right
      const leftW = L.inner * 0.6 - 60, nameF = sans(750, 22), cF = sans(500, 12);
      const nl = L.wrapText(d.company?.name || '', nameF, leftW);
      const cl = [d.company?.phone, d.company?.address, d.company?.gstin ? `GSTIN ${d.company.gstin}` : null].filter(Boolean).flatMap((s) => L.wrapText(s, cF, leftW));
      const titleF = sans(800, 22), tl = L.wrapText(String(d.title), titleF, L.inner * 0.38);
      const hdrH = Math.max(52, nl.length * 28 + cl.length * 17, tl.length * 28 + 22);
      L.add(hdrH, (ctx, y) => {
        drawMark(ctx, d, L.X + 22, y + 22, 22, { square: true });
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; let ty = y;
        ctx.font = nameF; ctx.fillStyle = ink; nl.forEach((l) => { ctx.fillText(l, L.X + 60, ty + 22); ty += 28; });
        ctx.font = cF; ctx.fillStyle = muted; cl.forEach((l) => { ctx.fillText(l, L.X + 60, ty + 13); ty += 17; });
        ctx.textAlign = 'right'; ctx.font = titleF; ctx.fillStyle = ink; tl.forEach((l, i) => ctx.fillText(l, L.X + L.inner, y + 22 + i * 28));
        ctx.font = sans(500, 13); ctx.fillStyle = muted; ctx.fillText(d.when, L.X + L.inner, y + 22 + tl.length * 28 - 6);
      });
      L.gap(18); L.rule('thick', rule, 4); L.gap(14);
      if (d.subtitle) {
        L.text(tx('BILL TO'), sans(700, 11), muted, 'left', 16);
        L.text(String(d.subtitle).replace(/^To:\s*/, ''), sans(600, 15), ink, 'left', 21);
        L.gap(14);
      }
      // the table: Item | Qty | Rate | Amount for bills, Item | Amount for everything else
      const table = hasTable(d.lines);
      const colAmt = L.X + L.inner - 12, colRate = colAmt - 130, colQty = colRate - 110;
      const itemW = (table ? colQty - 60 : colAmt - 150) - L.X - 12;
      L.add(36, (ctx, y) => {
        ctx.fillStyle = '#f3f4f7'; ctx.fillRect(L.X, y, L.inner, 36);
        ctx.font = sans(700, 12); ctx.fillStyle = muted; ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left'; ctx.fillText(tx('ITEM'), L.X + 12, y + 23);
        ctx.textAlign = 'right';
        if (table) { ctx.fillText(tx('QTY'), colQty, y + 23); ctx.fillText(tx('RATE'), colRate, y + 23); }
        ctx.fillText(tx('AMOUNT'), colAmt, y + 23);
      });
      for (const ln of d.lines) {
        if (ln.kind === 'heading') { L.gap(4); L.text(String(ln.label).toUpperCase(), sans(700, 12), muted, 'left', 22); continue; }
        const bold = ln.kind === 'sub', f = sans(bold ? 700 : 500, 15);
        const ls = L.wrapText(ln.label, f, itemW);
        const note = !table && ln.note ? 17 : 0;
        const rowH = ls.length * 22 + note + 16;
        L.add(rowH, (ctx, y) => {
          ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = f; ctx.fillStyle = ln.kind === 'muted' ? muted : ink;
          ls.forEach((l, i) => ctx.fillText(l, L.X + 12, y + 8 + 22 * (i + 0.78)));
          if (note) { ctx.font = sans(500, 12); ctx.fillStyle = muted; ctx.fillText(ln.note, L.X + 12, y + 8 + ls.length * 22 + 11); }
          ctx.textAlign = 'right'; ctx.font = sans(bold ? 750 : 600, 15);
          if (table && ln.qty != null) { ctx.fillStyle = ink; ctx.fillText(String(ln.qty), colQty, y + 8 + 22 * 0.78); ctx.fillText(String(ln.rate ?? ''), colRate, y + 8 + 22 * 0.78); }
          if (ln.value) { ctx.fillStyle = ln.negative ? '#c42631' : ink; ctx.fillText(ln.value, colAmt, y + 8 + 22 * 0.78); }
          drawRule(ctx, 'solid', soft, L.X, L.X + L.inner, y + rowH);
        });
      }
      L.gap(10);
      L.add(48, (ctx, y) => {
        drawRule(ctx, 'thick', ink, L.X + L.inner * 0.5, L.X + L.inner, y + 2);
        ctx.textBaseline = 'alphabetic'; ctx.font = sans(700, 15); ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.fillText(d.totalLabel, L.X + L.inner * 0.5 + 12, y + 34);
        ctx.font = sans(800, 24); ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.fillText(d.total, colAmt, y + 36);
      });
      if (d.words) { L.gap(10); L.text(`${tx('Amount in words')}: ${d.words}`, sans(500, 13), ink, 'left', 19); }
      L.gap(26);
      if (d.footer) L.text(d.footer, sans(500, 13), muted, 'left', 19);
      L.gap(18);
      const forF = sans(700, 13), forTxt = d.company?.name ? `${tx('For')} ${d.company.name}` : '';
      L.add(78, (ctx, y) => { // signature line
        const x1 = L.X + L.inner, x0 = x1 - 230;
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right'; ctx.font = forF; ctx.fillStyle = ink; if (forTxt) ctx.fillText(forTxt, x1, y + 16);
        drawRule(ctx, 'solid', ink, x0, x1, y + 56);
        ctx.font = sans(500, 11); ctx.fillStyle = muted; ctx.fillText(tx('Authorised signatory'), x1, y + 72);
      });
      L.gap(30);
    },
  },
  bold: {
    W: 640, margin: 36, pad: 34, shape: 'round', radius: 32, paper: '#ffffff', shadow: 'rgba(0,0,0,.28)',
    bg(ctx, W, H, d) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, d.brandLight); g.addColorStop(1, d.brandDeep); return g; },
    compose(L, d) {
      const ink = '#0b1020', muted = '#6b7489';
      L.gap(30); L.add(56, (ctx, y) => drawMark(ctx, d, L.X + L.inner / 2, y + 26, 26, { square: !!d.logo })); L.gap(6);
      if (d.company?.name) L.text(d.company.name, sans(750, 20), ink, 'center', 26);
      if (d.contact) L.text(d.contact, sans(500, 12), muted, 'center', 17);
      L.gap(20);
      L.text(String(d.totalLabel).toUpperCase(), sans(700, 13), muted, 'center', 20);
      L.add(80, (ctx, y) => { ctx.font = sans(800, 64); ctx.fillStyle = d.brand; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(d.total, L.X + L.inner / 2, y + 64); });
      if (d.words) L.text(d.words, sans(500, 14), '#465069', 'center', 20);
      L.gap(14);
      L.text(`${d.title} · ${d.when}`, sans(600, 13), muted, 'center', 19);
      if (d.subtitle) L.text(d.subtitle, sans(500, 13), muted, 'center', 19);
      if (d.company?.gstin) L.text(`GSTIN ${d.company.gstin}`, sans(500, 12), muted, 'center', 17);
      L.gap(14); L.rule('dashed', '#dfe3ec'); L.gap(6);
      lineRows(L, d.lines, { font: sans, ink, muted, neg: '#c42631', subRule: '#e1e5ee' });
      L.gap(14);
      if (d.footer) L.text(d.footer, sans(600, 13), muted, 'center', 19);
      L.gap(28);
    },
  },
};

const hexMix = (hex, to, t) => { const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16)); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

/** The paper outline: torn top and bottom, torn bottom only, rounded, or square. */
function paperPath(ctx, page, x0, x1, top, bot) {
  const w = x1 - x0, tooth = 12, depth = 7, n = Math.floor(w / tooth), tw = w / n;
  ctx.beginPath();
  if (page.shape === 'round') { if (ctx.roundRect) ctx.roundRect(x0, top, w, bot - top, page.radius); else ctx.rect(x0, top, w, bot - top); return; }
  if (page.shape === 'square') { ctx.rect(x0, top, w, bot - top); return; }
  if (page.shape === 'torn') { ctx.moveTo(x0, top + depth); for (let i = 0; i < n; i++) { ctx.lineTo(x0 + tw * (i + 0.5), top); ctx.lineTo(x0 + tw * (i + 1), top + depth); } }
  else { ctx.moveTo(x0, top); ctx.lineTo(x1, top); }
  ctx.lineTo(x1, bot - depth);
  for (let i = n; i > 0; i--) { ctx.lineTo(x0 + tw * (i - 0.5), bot); ctx.lineTo(x0 + tw * (i - 1), bot - depth); }
  ctx.closePath();
}

/**
 * opts: { company, title, subtitle?, when?, lines: [{label, value?, kind?: 'heading'|'sub'|'muted', note?, negative?, qty?, rate?}],
 *         totalLabel?, total, words?, footer? | status? + thanks?, tpl? }
 * render: { tpl?, scale? } — template id (default: the shop's choice on this device) and pixel scale.
 * Returns a PNG Blob.
 */
export async function renderReceipt(opts, render = {}) {
  const prefs = prefsNow();
  const tpl = templateById(render.tpl || opts.tpl || prefs.tpl).id;
  const page = PAGES[tpl];
  const company = opts.company;
  const brand = /^#[0-9a-f]{6}$/i.test(company?.primary_color || '') ? company.primary_color.toLowerCase() : '#2e6f4f';
  const families = tpl === 'paper' ? [SANS, SERIF] : tpl === 'thermal' ? [] : [SANS];
  try { await Promise.all(families.flatMap((fam) => [400, 700, 800].map((w) => document.fonts.load(`${w} 16px ${fam}`, 'Aअ₹1')))); } catch { /* fonts are optional */ }
  const d = {
    company, brand, brandLight: hexMix(brand, '#ffffff', 0.18), brandDeep: hexMix(brand, '#000000', 0.38),
    logo: tpl === 'thermal' ? null : await logoImage(company),
    when: whenText(opts.when), title: opts.title || tx('Receipt'), subtitle: opts.subtitle || '',
    contact: [company?.phone, company?.address].filter(Boolean).join(' · '),
    lines: opts.lines || [], totalLabel: opts.totalLabel || tx('TOTAL'), total: opts.total, words: opts.words || '',
    footer: footerFor(opts, prefs),
  };
  const L = makeLayout(page);
  page.compose(L, d);

  const contentH = L.items.reduce((s, i) => s + i.h, 0);
  const W = page.W, H = Math.ceil(contentH + page.margin * 2);
  const scale = Math.max(1, Math.min(render.scale || SCALE, Math.sqrt(MAX_PIXELS / (W * H))));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = page.bg(ctx, W, H, d); ctx.fillRect(0, 0, W, H);
  const x0 = page.margin, x1 = W - page.margin, top = page.margin, bot = H - page.margin;
  ctx.save();
  ctx.shadowColor = page.shadow; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  paperPath(ctx, page, x0, x1, top, bot); ctx.fillStyle = page.paper; ctx.fill();
  ctx.restore();
  if (page.border) { ctx.save(); paperPath(ctx, page, x0 + 0.5, x1 - 0.5, top + 0.5, bot - 0.5); ctx.strokeStyle = page.border; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
  ctx.save(); ctx.translate(page.margin, 0);
  let y = top + 4;
  for (const it of L.items) { it.draw(ctx, y); y += it.h; }
  ctx.restore();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'));
}

const whenText = (w) => (w ? new Date(w) : new Date()).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const totalLine = (opts) => `${titleCase(opts.totalLabel || 'Total')}: *${opts.total}*`;
const titleCase = (s) => String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Short message that travels with the picture: who, what, the final amount, and when. */
export function receiptCaption(opts) {
  return [opts.company?.name ? `*${opts.company.name}*` : null, opts.title, totalLine(opts), opts.words || null, `🕒 ${whenText(opts.when)}`].filter(Boolean).join('\n');
}

/** Plain-text version for apps that only take text. */
export function receiptText(opts) {
  const out = [opts.company?.name ? `*${opts.company.name}*` : null, opts.title, `🕒 ${whenText(opts.when)}`, ''].filter((x) => x !== null);
  for (const l of opts.lines) out.push(l.kind === 'heading' ? `\n${l.label}` : l.value ? `${l.label}: ${l.value}` : l.label);
  out.push('', totalLine(opts));
  if (opts.words) out.push(opts.words);
  const foot = footerFor(opts, prefsNow());
  if (foot) out.push('', foot);
  return out.join('\n');
}

function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
/** A bill with the customer's phone: open their WhatsApp chat with the bill as text (WhatsApp links cannot carry a picture). */
function waBtn(opts, text) {
  const digits = String(opts.phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 10) return null;
  const to = digits.length === 10 ? '91' + digits : digits;
  return h('a', { class: 'btn block', href: `https://wa.me/${to}?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener' }, icon('share', 18), tx('Send to customer on WhatsApp'));
}
const slug = (s) => String(s || 'receipt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'receipt';

/** Shows the receipt with a template switcher and lets the person share it as a picture, save it, or send it as text. */
export function openReceiptSheet(opts) {
  opts = { ...opts, when: opts.when || new Date() }; // the picture and the message show the same time
  const prefs = readReceiptPrefs();
  let tpl = templateById(opts.tpl || prefs.tpl).id;
  const cache = new Map(); // template id -> { blob, url }
  const preview = h('div', { class: 'receipt-stage' }, h('div', { class: 'boot', style: { padding: '40px 0' } }, h('div', { class: 'spinner' }), h('div', { class: 'small muted', style: { marginTop: '12px' } }, tx('Preparing receipt…'))));
  const actions = h('div', { class: 'receipt-actions' });
  const picker = h('div', { class: 'rtpls', role: 'group', 'aria-label': tx('Receipt design') });
  const m = modal(opts.sheetTitle || tx('Share receipt'), h('div', null, picker, preview, actions));
  const text = receiptText(opts);
  const closeOrig = m.close;
  m.close = () => { for (const c of cache.values()) URL.revokeObjectURL(c.url); closeOrig(); };

  const drawPicker = () => mount(picker, TEMPLATES.map((t) => h('button', {
    type: 'button', class: 'chip small' + (t.id === tpl ? ' on' : ''), 'aria-pressed': t.id === tpl ? 'true' : 'false',
    onclick: () => { if (t.id === tpl) return; tpl = t.id; writeReceiptPrefs({ ...readReceiptPrefs(), tpl }); drawPicker(); show(); },
  }, tx(t.name))));

  async function show() {
    const want = tpl;
    preview.classList.add('busy');
    try {
      if (!cache.has(want)) { const blob = await renderReceipt(opts, { tpl: want }); cache.set(want, { blob, url: URL.createObjectURL(blob) }); }
      if (want !== tpl) return; // another template was picked meanwhile
      const { blob, url } = cache.get(want);
      const name = `${slug(opts.company?.name)}-${slug(opts.title)}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      const canShareFile = !!navigator.canShare?.({ files: [file] });
      const shareBtn = h('button', { class: 'primary block', onclick: async () => {
        // must run straight from the tap: the share sheet is only allowed from a user gesture
        try { await navigator.share({ files: [file], title: opts.title, text: receiptCaption(opts) }); }
        catch (e) { if (e.name !== 'AbortError') { download(blob, name); toast(tx('Saved to your downloads')); } }
      } }, icon('share', 18), tx('Share image'));
      const saveBtn = h('button', { class: canShareFile ? 'block' : 'primary block', onclick: () => { download(blob, name); toast(tx('Saved to your downloads')); } }, icon('download', 18), tx('Save image'));
      const textBtn = h('button', { class: 'block ghost', onclick: async () => {
        try { if (navigator.share) await navigator.share({ text }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); }
        catch (e) { if (e.name !== 'AbortError') toast(tx('Could not open sharing'), true); }
      } }, tx('Send as text instead'));
      mount(preview, h('img', { class: 'receipt-preview', src: url, alt: `${opts.title} ${tx('receipt')}` }));
      mount(actions, canShareFile ? shareBtn : null, waBtn(opts, text), saveBtn, textBtn);
    } catch (e) {
      mount(preview, h('div', { class: 'alert error' }, e.message || tx('Could not create the receipt')));
    } finally { preview.classList.remove('busy'); }
  }
  drawPicker(); show();
  return m;
}

/** A made-up bill for previews in Settings, drawn with the shop's real name, logo and colour. */
export function sampleReceipt(company) {
  return {
    company, title: 'Bill #101', subtitle: 'To: Mehta ji · 98xxxxxx10', when: new Date(),
    lines: [
      { label: 'Campa Cola 750 ml', note: '2 × ₹40', qty: 2, rate: '₹40', value: '₹80' },
      { label: 'Lays Classic', note: '3 × ₹20', qty: 3, rate: '₹20', value: '₹60' },
      { label: 'Discount', value: '−₹10', negative: true },
    ],
    totalLabel: 'TOTAL', total: '₹130', words: 'Rupees One Hundred Thirty Only', status: 'Paid by UPI', thanks: true,
  };
}
