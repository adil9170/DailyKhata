// Receipt images: draws a receipt on a canvas (company name/logo, lines, total, amount in words) and shares it
// the way a phone expects: the share sheet (WhatsApp, Instagram, Messages…) with the picture attached.
import { h, mount, icon, modal, toast } from './ui.js';
import { logoImage } from './brandicon.js';

const FONT = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif';
const W = 640, MARGIN = 28, PAD = 34, SCALE = 2;


function wrap(ctx, text, maxW) {
  const out = []; let cur = '';
  for (const word of String(text).split(/\s+/)) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(t).width > maxW) { out.push(cur); cur = word; } else cur = t;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

/**
 * opts: { company, title, subtitle?, when?, lines: [{label, value?, kind?: 'heading'|'sub', note?}], totalLabel?, total, words?, footer? }
 * Returns a PNG Blob.
 */
export async function renderReceipt(opts) {
  const { company, title, subtitle, lines, total, words, footer } = opts;
  const brand = /^#[0-9a-f]{6}$/i.test(company?.primary_color || '') ? company.primary_color : '#635bff';
  const when = whenText(opts.when);
  try { await Promise.all([document.fonts.load(`400 15px ${FONT}`), document.fonts.load(`700 15px ${FONT}`), document.fonts.load(`800 40px ${FONT}`)]); } catch { /* fonts are optional */ }
  const logo = await logoImage(company);

  const paperW = W - MARGIN * 2, inner = paperW - PAD * 2;
  const probe = document.createElement('canvas').getContext('2d');
  const font = (w, px) => `${w} ${px}px ${FONT}`;

  // ---- layout pass (measure everything, then draw) ----
  const items = []; // {draw(ctx, y)} with heights
  const gap = (px) => items.push({ h: px, draw() {} });
  const dashed = () => items.push({ h: 18, draw(ctx, y) { ctx.save(); ctx.strokeStyle = '#c4cad9'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(PAD, y + 9); ctx.lineTo(PAD + inner, y + 9); ctx.stroke(); ctx.restore(); } });
  const text = (str, f, color, align, lh, maxW = inner) => {
    probe.font = f; const ls = wrap(probe, str, maxW);
    items.push({ h: ls.length * lh, draw(ctx, y) { ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
      const x = align === 'center' ? PAD + inner / 2 : align === 'right' ? PAD + inner : PAD; ls.forEach((l, i) => ctx.fillText(l, x, y + lh * (i + 0.76))); } });
  };

  gap(30);
  items.push({ h: 66, draw(ctx, y) {
    const cx = PAD + inner / 2, r = 30;
    ctx.save(); ctx.beginPath();
    if (logo) { ctx.roundRect ? ctx.roundRect(cx - r, y, r * 2, r * 2, 16) : ctx.rect(cx - r, y, r * 2, r * 2); } else ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.closePath();
    if (logo) { ctx.clip(); ctx.fillStyle = '#fff'; ctx.fill(); const lw = logo.naturalWidth || logo.width, lh = logo.naturalHeight || logo.height, k = Math.min((r * 2) / lw, (r * 2) / lh); ctx.drawImage(logo, cx - (lw * k) / 2, y + r - (lh * k) / 2, lw * k, lh * k); }
    else { ctx.fillStyle = brand; ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = font(800, 28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((company?.name || 'D')[0].toUpperCase(), cx, y + r + 1); }
    ctx.restore(); } });
  gap(10);
  if (company?.name) text(company.name, font(750, 24), '#0b1020', 'center', 30);
  const contact = [company?.phone, company?.address].filter(Boolean).join(' · ');
  if (contact) text(contact, font(500, 13), '#7d869c', 'center', 18);
  if (company?.gstin) text(`GSTIN ${company.gstin}`, font(500, 12), '#7d869c', 'center', 17);
  gap(14); dashed(); gap(8);

  // title + date
  probe.font = font(500, 13); const whenW = probe.measureText(when).width;
  probe.font = font(750, 18);
  const tl = wrap(probe, title, inner - whenW - 16);
  items.push({ h: tl.length * 24, draw(ctx, y) { ctx.font = font(750, 18); ctx.fillStyle = '#0b1020'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; tl.forEach((l, i) => ctx.fillText(l, PAD, y + 24 * (i + 0.74)));
    ctx.font = font(500, 13); ctx.fillStyle = '#7d869c'; ctx.textAlign = 'right'; ctx.fillText(when, PAD + inner, y + 17); } });
  if (subtitle) text(subtitle, font(500, 13), '#7d869c', 'left', 18);
  gap(10);

  // lines
  const valueW = 150;
  for (const ln of lines) {
    if (ln.kind === 'heading') { gap(6); text(String(ln.label).toUpperCase(), font(700, 12), '#7d869c', 'left', 18); continue; }
    const bold = ln.kind === 'sub';
    probe.font = font(bold ? 700 : 500, 15);
    const ls = wrap(probe, ln.label, ln.value ? inner - valueW - 12 : inner);
    const note = ln.note ? 17 : 0;
    items.push({ h: ls.length * 22 + note + 8, draw(ctx, y) {
      if (bold) { ctx.save(); ctx.strokeStyle = '#e1e5ee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD, y + 1); ctx.lineTo(PAD + inner, y + 1); ctx.stroke(); ctx.restore(); }
      ctx.textBaseline = 'alphabetic'; ctx.font = font(bold ? 700 : 500, 15); ctx.fillStyle = ln.kind === 'muted' ? '#7d869c' : '#0b1020'; ctx.textAlign = 'left';
      ls.forEach((l, i) => ctx.fillText(l, PAD, y + 4 + 22 * (i + 0.78)));
      if (ln.note) { ctx.font = font(500, 12); ctx.fillStyle = '#7d869c'; ctx.fillText(ln.note, PAD, y + 4 + ls.length * 22 + 11); }
      if (ln.value) { ctx.font = font(bold ? 750 : 650, 15); ctx.fillStyle = ln.negative ? '#c42631' : '#0b1020'; ctx.textAlign = 'right'; ctx.fillText(ln.value, PAD + inner, y + 4 + 22 * 0.78); } } });
  }
  gap(8); dashed(); gap(6);

  // total
  text(opts.totalLabel || 'TOTAL', font(700, 12), '#7d869c', 'center', 20);
  items.push({ h: 54, draw(ctx, y) { ctx.font = font(800, 42); ctx.fillStyle = brand; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(total, PAD + inner / 2, y + 42); } });
  if (words) text(words, font(500, 14), '#465069', 'center', 20);
  gap(18);
  if (footer) { text(footer, font(500, 13), '#7d869c', 'center', 19); gap(6); }
  gap(30);

  // ---- draw pass ----
  const contentH = items.reduce((s, i) => s + i.h, 0);
  const H = Math.ceil(contentH + MARGIN * 2);
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#eceff7'); bg.addColorStop(1, '#dfe4f1');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // paper with torn (zig-zag) top and bottom edges
  const x0 = MARGIN, x1 = MARGIN + paperW, top = MARGIN, bot = H - MARGIN, tooth = 12, depth = 7;
  const n = Math.floor(paperW / tooth), tw = paperW / n;
  ctx.save();
  ctx.shadowColor = 'rgba(16,24,48,.22)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  ctx.beginPath(); ctx.moveTo(x0, top + depth);
  for (let i = 0; i < n; i++) { ctx.lineTo(x0 + tw * (i + 0.5), top); ctx.lineTo(x0 + tw * (i + 1), top + depth); }
  ctx.lineTo(x1, bot - depth);
  for (let i = n; i > 0; i--) { ctx.lineTo(x0 + tw * (i - 0.5), bot); ctx.lineTo(x0 + tw * (i - 1), bot - depth); }
  ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(MARGIN, 0);
  let y = top + 4;
  for (const it of items) { it.draw(ctx, y); y += it.h; }
  ctx.restore();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'));
}

const whenText = (w) => (w ? new Date(w) : new Date()).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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
  return out.join('\n');
}

function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
const slug = (s) => String(s || 'receipt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'receipt';

/** Shows the receipt and lets the person share it as a picture, save it, or send it as text. */
export function openReceiptSheet(opts) {
  opts = { ...opts, when: opts.when || new Date() }; // the picture and the message show the same time
  const body = h('div', null, h('div', { class: 'boot', style: { padding: '40px 0' } }, h('div', { class: 'spinner' }), h('div', { class: 'small muted', style: { marginTop: '12px' } }, 'Preparing receipt…')));
  const m = modal('Share receipt', body);
  const name = `${slug(opts.company?.name)}-${slug(opts.title)}.png`;
  const text = receiptText(opts);
  let url;
  const closeOrig = m.close;
  m.close = () => { if (url) URL.revokeObjectURL(url); closeOrig(); };
  renderReceipt(opts).then((blob) => {
    url = URL.createObjectURL(blob);
    const file = new File([blob], name, { type: 'image/png' });
    const canShareFile = !!navigator.canShare?.({ files: [file] });
    const shareBtn = h('button', { class: 'primary block', onclick: async () => {
      // must run straight from the tap: the share sheet is only allowed from a user gesture
      try { await navigator.share({ files: [file], title: opts.title, text: receiptCaption(opts) }); }
      catch (e) { if (e.name !== 'AbortError') { download(blob, name); toast('Saved to your downloads'); } }
    } }, icon('share', 18), 'Share image');
    const saveBtn = h('button', { class: canShareFile ? 'block' : 'primary block', onclick: () => { download(blob, name); toast('Saved to your downloads'); } }, icon('download', 18), 'Save image');
    const textBtn = h('button', { class: 'block ghost', onclick: async () => {
      try { if (navigator.share) await navigator.share({ text }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); }
      catch (e) { if (e.name !== 'AbortError') toast('Could not open sharing', true); }
    } }, 'Send as text instead');
    mount(body, h('img', { class: 'receipt-preview', src: url, alt: `${opts.title} receipt` }),
      h('div', { class: 'receipt-actions' }, canShareFile ? shareBtn : null, saveBtn, textBtn));
  }).catch((e) => { mount(body, h('div', { class: 'alert error' }, e.message || 'Could not create the receipt')); });
  return m;
}

