import { h, mount, fmtDateTime, badge } from '../ui.js';
import { api } from '../api.js';

const KIND = { create: 'good', bulk_create: 'good', update: 'warn', delete: 'bad', archive: 'bad', login_failed: 'bad', suspend: 'bad' };

export function auditRows(rows, { showCompany = false } = {}) {
  return rows.map((r) => {
    const detail = r.before_json || r.after_json ? h('details', null, h('summary', { class: 'small' }, 'Details'),
      r.before_json ? h('div', null, h('div', { class: 'small muted' }, 'Before'), h('pre', { class: 'diff' }, pretty(r.before_json))) : null,
      r.after_json ? h('div', null, h('div', { class: 'small muted' }, 'After'), h('pre', { class: 'diff' }, pretty(r.after_json))) : null) : null;
    return h('tr', null, h('td', { class: 'small', style: { whiteSpace: 'nowrap' } }, fmtDateTime(r.created_at)),
      showCompany ? h('td', null, r.company_name || '—') : null,
      h('td', null, r.user_name || 'system'), h('td', null, badge(r.action.replace('_', ' '), KIND[r.action] || '')),
      h('td', null, r.entity.replace(/_/g, ' '), r.entity_id ? ` #${r.entity_id}` : '', detail), h('td', { class: 'small muted' }, r.ip || ''));
  });
}
function pretty(s) { try { return JSON.stringify(JSON.parse(s), null, 1); } catch { return s; } }

export async function auditPage(main) {
  const body = h('tbody');
  const more = h('button', null, 'Load more');
  let last = null;
  const load = async () => {
    const rows = await api('/api/c/audit' + (last ? `?before=${last}` : ''));
    body.append(...auditRows(rows));
    if (rows.length) last = rows[rows.length - 1].id;
    more.classList.toggle('hidden', rows.length < 100);
  };
  more.addEventListener('click', load);
  mount(main, h('h1', null, 'Audit log'), h('p', { class: 'muted' }, 'Every change to accounts, stock, team and settings — who, when and what changed.'),
    h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['When', 'Who', 'Action', 'Record', 'IP'].map((t) => h('th', null, t)))), body)), more));
  await load();
}
