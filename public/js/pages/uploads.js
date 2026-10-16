// Photos of handwritten hisaab, bills and receipts → OCR → review → confirm.
import { h, mount, toast, busy, table, badge, bytes, fmtDate, fmtDateTime, confirmDialog } from '../ui.js';
import { api, state, can, companyUrl, todayLocal, navigate, refreshLists } from '../api.js';
import { uploadDoc } from './day.js';
import { reviewEditor } from './review.js';

const STATUS = { none: ['Not read', ''], processing: ['Reading…', 'warn'], extracted: ['Needs review', 'warn'], confirmed: ['Saved', 'good'], failed: ['Failed', 'bad'] };

export async function uploadsPage(main, params) {
  const reviewId = Number(params.get('review'));
  if (reviewId) return reviewPage(main, reviewId);
  const docs = await api('/api/c/documents');
  const kind = h('select', null, [['hisaab', 'Hisaab page'], ['bill', 'Supplier bill'], ['receipt', 'Expense receipt'], ['other', 'Other']].map(([v, l]) => h('option', { value: v }, l)));
  const date = h('input', { type: 'date', value: state.today || todayLocal() });
  const file = h('input', { type: 'file', accept: 'image/*,application/pdf', capture: 'environment' });
  const btn = h('button', { class: 'primary' }, 'Upload');
  btn.addEventListener('click', busy(btn, async () => {
    const f = file.files[0]; if (!f) return toast('Choose a photo first', true);
    const doc = await uploadDoc(f, kind.value, date.value);
    toast('Uploaded');
    if (doc.content_type.startsWith('image/') && state.company?.ocr_enabled && can('entries.write')) navigate(`#/uploads?review=${doc.id}`); else navigate('#/uploads');
  }));
  const rows = docs.map((d) => {
    const [label, k] = STATUS[d.ocr_status] || [d.ocr_status, ''];
    return h('tr', null,
      h('td', null, d.content_type.startsWith('image/') ? h('img', { src: companyUrl(`/api/c/documents/${d.id}/file`), alt: '', loading: 'lazy', style: { width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' } }) : '📄'),
      h('td', null, h('a', { href: companyUrl(`/api/c/documents/${d.id}/file`), target: '_blank', rel: 'noopener' }, d.filename), h('div', { class: 'small muted' }, `${d.kind} · ${bytes(d.size_bytes)} · ${d.uploaded_by_name || ''}`)),
      h('td', null, d.entry_date ? fmtDate(d.entry_date) : '—'), h('td', null, badge(label, k)), h('td', { class: 'small muted' }, fmtDateTime(d.created_at)),
      h('td', { class: 'right' }, h('span', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
        d.content_type.startsWith('image/') && can('entries.write') && d.ocr_status !== 'confirmed' ? h('a', { class: 'btn small', href: `#/uploads?review=${d.id}` }, 'Read & review') : null,
        can('entries.delete') ? h('button', { class: 'small ghost danger', 'aria-label': 'Delete', onclick: async () => {
          if (!(await confirmDialog('Delete this file? Entries saved from it are kept.'))) return;
          await api(`/api/c/documents/${d.id}`, { method: 'DELETE' }); toast('Deleted'); navigate('#/uploads');
        } }, '🗑') : null)));
  });
  mount(main,
    h('h1', null, 'Photos & Bills'), h('p', { class: 'muted' }, 'Upload photos of your handwritten hisaab, supplier bills or receipts. Files are private to your company.'),
    can('uploads.write') ? h('div', { class: 'card' }, h('div', { class: 'fields' },
      h('div', { class: 'field' }, h('label', null, 'Photo or PDF', file)), h('div', { class: 'field' }, h('label', null, 'Type', kind)),
      h('div', { class: 'field' }, h('label', null, 'Date', date)), h('div', { class: 'field' }, btn)),
      !state.company?.ocr_enabled ? h('div', { class: 'small muted' }, 'Automatic reading is not included in your plan — files are stored for reference.') : null) : null,
    h('div', { class: 'card' }, table(['', 'File', 'Date', 'Status', 'Uploaded', ''], rows, { empty: 'No uploads yet' })));
}

async function reviewPage(main, id) {
  const doc = await api(`/api/c/documents/${id}`);
  const right = h('div');
  const run = h('button', { class: 'primary' }, doc.ocr_result ? 'Read again' : 'Read this photo');
  const showReview = (out) => mount(right,
    h('div', { class: 'small muted', style: { marginBottom: '8px' } }, `Read by ${out.engine === 'claude' ? 'Claude AI' : 'Workers AI'}. Check every number against the photo, fix anything wrong, then confirm.`),
    out.raw_text ? h('details', { style: { marginBottom: '8px' } }, h('summary', null, 'Raw text'), h('pre', { class: 'diff' }, out.raw_text)) : null,
    reviewEditor({ parsed: out.result, date: doc.entry_date || state.today || todayLocal(), documentId: doc.id,
      onSaved: async (d) => { await refreshLists(); navigate(`#/day?date=${d}`); }, onCancel: () => navigate('#/uploads') }));
  run.addEventListener('click', busy(run, async () => {
    mount(right, h('div', { class: 'boot' }, 'Reading the photo… this can take up to a minute.'));
    try { showReview(await api(`/api/c/documents/${id}/extract`, { method: 'POST' })); }
    catch (e) { mount(right, h('div', { class: 'alert error' }, e.message), manualHint()); throw e; }
  }));
  const manualHint = () => h('div', null, h('p', { class: 'muted' }, 'You can also type the entries yourself while looking at the photo:'),
    reviewEditor({ parsed: { purchases: [{ item: '', qty: 1, unit: 'box', pieces: '', total: '' }], expenses: [], collections: [] }, date: doc.entry_date || state.today || todayLocal(), documentId: doc.id,
      onSaved: (d) => navigate(`#/day?date=${d}`), onCancel: () => navigate('#/uploads') }));
  mount(main,
    h('div', { class: 'spread' }, h('h1', null, 'Review photo'), h('a', { class: 'btn small', href: '#/uploads' }, '← All uploads')),
    doc.ocr_status === 'confirmed' ? h('div', { class: 'alert info' }, 'Entries from this photo were already saved. Saving again will add them a second time.') : null,
    h('div', { class: 'review-grid' },
      h('div', { class: 'card' }, h('a', { href: companyUrl(`/api/c/documents/${id}/file`), target: '_blank', rel: 'noopener' },
        h('img', { class: 'photo-thumb', src: companyUrl(`/api/c/documents/${id}/file`), alt: doc.filename })),
        h('div', { class: 'row', style: { marginTop: '8px' } }, state.company?.ocr_enabled ? run : h('span', { class: 'muted small' }, 'Automatic reading not in your plan'))),
      h('div', { class: 'card' }, right)));
  if (doc.ocr_result) showReview(doc.ocr_result);
  else if (state.company?.ocr_enabled && doc.ocr_status !== 'confirmed') run.click();
  else mount(right, manualHint());
}
