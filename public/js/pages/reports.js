import { h, mount, money, num, cls, fmtDate, addDays, table, busy, toast } from '../ui.js';
import { api, state, can, todayLocal, download, navigate } from '../api.js';
import { presetRange } from './dashboard.js';

export async function reportsPage(main, params) {
  const today = state.today || todayLocal();
  const tab = params.get('tab') || 'day';
  const tabs = [['day', 'Day report'], ['compare', 'Compare periods'], ['export', 'Export']];
  const content = h('div');
  mount(main, h('h1', null, 'Reports'),
    h('div', { class: 'seg noprint', style: { marginBottom: '14px' } }, tabs.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => navigate(`#/reports?tab=${k}`) }, l))),
    content);
  if (tab === 'day') return dayReport(content, params.get('date') || today);
  if (tab === 'compare') return compare(content, params, today);
  return exportTab(content, today);
}

async function dayReport(el, date) {
  const d = await api(`/api/c/reports/day/${date}`);
  const di = h('input', { type: 'date', value: date, onchange: (e) => navigate(`#/reports?tab=day&date=${e.target.value}`) });
  const p = d.profit;
  const kv = (rows) => h('div', { class: 'kv' }, rows.flatMap(([k, v, tot]) => [h('div', { class: tot ? 'tot' : '' }, k), h('div', { class: tot ? 'tot' : '' }, v)]));
  mount(el,
    h('div', { class: 'row noprint', style: { marginBottom: '12px' } },
      h('button', { onclick: () => navigate(`#/reports?tab=day&date=${addDays(date, -1)}`) }, '‹'), di, h('button', { onclick: () => navigate(`#/reports?tab=day&date=${addDays(date, 1)}`) }, '›'),
      h('span', { class: 'grow' }), h('button', { onclick: () => print() }, '🖨 Print'),
      can('export') ? h('button', { onclick: () => download(`/api/c/export?from=${date}&to=${date}&format=xlsx`, 'day.xlsx') }, '⬇ Excel') : null),
    h('div', { class: 'card' }, h('h2', null, `${state.company?.name ?? ''} — ${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`),
      h('div', { class: 'grid g3' },
        h('div', null, h('h3', null, 'Money'), kv([
          ['Collection (all modes)', money(d.collections.total)], ['  of which cash', money(d.collections.cash)], ['  UPI / card', money(d.collections.upi + d.collections.card)], ['  udhaar sales', money(d.collections.credit)],
          ['Purchases', money(d.purchases.total)], ['Expenses', money(d.expenses.total)], ['Net cash flow', h('span', { class: cls(d.net_cash_flow) }, money(d.net_cash_flow)), true]])),
        h('div', null, h('h3', null, 'Cash drawer'), kv([
          ['Opening', money(d.cash.opening)], ['+ Cash in', money(d.cash.cash_in)], ['− Cash out', money(d.cash.cash_out)], ['Expected', money(d.cash.expected), true],
          ['Counted', money(d.cash.counted)], ['Difference', d.cash.difference === null ? '—' : h('span', { class: cls(d.cash.difference) }, money(d.cash.difference, { sign: true })), true]])),
        h('div', null, h('h3', null, 'Profit'), p.status === 'actual' ? kv([
          ['Sales revenue', money(p.revenue)], ['− Cost of goods sold', money(p.cogs)], ['Gross profit', money(p.gross), true], ['− Expenses', money(p.expenses)],
          ['Net profit', h('span', { class: cls(p.net) }, money(p.net)), true], ...(p.expected_sales_value !== null ? [['Expected sales at price list', money(p.expected_sales_value)]] : [])])
          : h('div', { class: 'alert info' }, p.reason || 'No activity'),
          h('div', { class: 'small muted', style: { marginTop: '8px' } }, `Outstanding: pay ${money(d.outstanding.payable)} · receive ${money(d.outstanding.receivable)}`)))),
    h('div', { class: 'card' }, h('h2', null, 'Stock movement'),
      table(['Item', 'Opening', 'Bought', 'Sold', 'Closing', 'Avg cost/pc', 'Cost of sold', 'Sale value', 'Stock value'], (d.products || []).map((r) => h('tr', null,
        h('td', null, r.name), h('td', { class: 'num' }, num(r.opening)), h('td', { class: 'num' }, num(r.purchased)), h('td', { class: 'num' }, r.sold === null ? '—' : num(r.sold)),
        h('td', { class: 'num' }, num(r.closing), r.counted ? '' : h('span', { class: 'muted small' }, ' est.')), h('td', { class: 'num' }, money(r.avg_cost_per_piece === null ? null : Math.round(r.avg_cost_per_piece))),
        h('td', { class: 'num' }, money(r.cogs)), h('td', { class: 'num' }, money(r.sale_value)), h('td', { class: 'num' }, money(r.stock_value)))), { empty: 'No stock activity' })),
    d.discrepancies.length ? h('div', { class: 'card' }, h('h2', null, 'Checks'), d.discrepancies.map((x) => h('div', { class: 'alert ' + x.severity }, x.message))) : null,
    h('div', { class: 'noprint' }, h('a', { class: 'btn', href: `#/day?date=${date}` }, 'Open daily entry for this day')));
}

async function compare(el, params, today) {
  const month = today.slice(0, 8) + '01';
  const lastEnd = addDays(month, -1);
  const a = [params.get('a_from') || month, params.get('a_to') || today];
  const b = [params.get('b_from') || lastEnd.slice(0, 8) + '01', params.get('b_to') || lastEnd];
  const ins = [...a, ...b].map((v) => h('input', { type: 'date', value: v }));
  const apply = () => navigate(`#/reports?tab=compare&a_from=${ins[0].value}&a_to=${ins[1].value}&b_from=${ins[2].value}&b_to=${ins[3].value}`);
  const quick = (pa, pb) => { const [x1, x2] = presetRange(pa, today); const [y1, y2] = pb(x1, x2); navigate(`#/reports?tab=compare&a_from=${x1}&a_to=${x2}&b_from=${y1}&b_to=${y2}`); };
  const r = await api(`/api/c/reports/compare?a_from=${a[0]}&a_to=${a[1]}&b_from=${b[0]}&b_to=${b[1]}`);
  const row = (label, fa, fb, good = 1) => {
    const va = fa(r.a), vb = fb(r.b); const diff = va === null || vb === null ? null : va - vb;
    const pct = diff !== null && vb ? Math.round((diff / Math.abs(vb)) * 100) : null;
    return h('tr', null, h('td', null, label), h('td', { class: 'num' }, money(va)), h('td', { class: 'num' }, money(vb)),
      h('td', { class: 'num ' + (diff ? cls(diff * good) : '') }, diff === null ? '—' : money(diff, { sign: true })), h('td', { class: 'num small' }, pct === null ? '' : `${pct > 0 ? '+' : ''}${pct}%`));
  };
  const pf = (t) => (t.profit.days_with_profit ? t.profit.net : null);
  mount(el, h('div', { class: 'card noprint' },
      h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', null, 'Period A from', ins[0])), h('div', { class: 'field' }, h('label', null, 'to', ins[1])),
        h('div', { class: 'field' }, h('label', null, 'Period B from', ins[2])), h('div', { class: 'field' }, h('label', null, 'to', ins[3])), h('div', { class: 'field' }, h('button', { class: 'primary', onclick: apply }, 'Compare'))),
      h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Quick:'),
        h('button', { class: 'small', onclick: () => quick('7d', (x1) => [addDays(x1, -7), addDays(x1, -1)]) }, 'Last 7 days vs previous 7'),
        h('button', { class: 'small', onclick: () => quick('30d', (x1) => [addDays(x1, -30), addDays(x1, -1)]) }, 'Last 30 vs previous 30'),
        h('button', { class: 'small', onclick: () => quick('today', (x1) => [addDays(x1, -7), addDays(x1, -7)]) }, 'Today vs same day last week'))),
    h('div', { class: 'card' }, table(['', `A: ${fmtDate(a[0])} – ${fmtDate(a[1])}`, `B: ${fmtDate(b[0])} – ${fmtDate(b[1])}`, 'Change', '%'], [
      row('Collections', (t) => t.collections, (t) => t.collections),
      row('Purchases', (t) => t.purchases, (t) => t.purchases, -1),
      row('Expenses', (t) => t.expenses, (t) => t.expenses, -1),
      row('Net cash flow', (t) => t.net_cash_flow, (t) => t.net_cash_flow),
      row('Net profit (counted days)', pf, pf),
      row('Cash difference', (t) => t.cash_difference_total, (t) => t.cash_difference_total),
      row('Udhaar given', (t) => t.credit_sales, (t) => t.credit_sales, -1),
    ]), h('div', { class: 'small muted', style: { marginTop: '8px' } }, `Profit coverage — A: ${r.a.profit.note}. B: ${r.b.profit.note}.`)));
}

function exportTab(el, today) {
  if (!can('export')) return mount(el, h('div', { class: 'card empty' }, 'You do not have permission to export.'));
  const [f0, t0] = presetRange('month', today);
  const from = h('input', { type: 'date', value: f0 }), to = h('input', { type: 'date', value: t0 });
  const type = h('select', null, [['all', 'Everything (one sheet each)'], ['summary', 'Daily summary'], ['purchases', 'Purchases'], ['expenses', 'Expenses'], ['collections', 'Collections'], ['payments', 'Udhaar payments'], ['stock', 'Stock movement']].map(([v, l]) => h('option', { value: v }, l)));
  const btnX = h('button', { class: 'primary' }, '⬇ Excel (.xlsx)'); const btnC = h('button', null, '⬇ CSV');
  const go = (fmt, btn) => busy(btn, async () => { await download(`/api/c/export?from=${from.value}&to=${to.value}&type=${type.value}&format=${fmt}`, `export.${fmt}`); toast('Download started'); });
  btnX.addEventListener('click', go('xlsx', btnX)); btnC.addEventListener('click', go('csv', btnC));
  mount(el, h('div', { class: 'card' }, h('h2', null, 'Export your accounts'),
    h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', null, 'From', from)), h('div', { class: 'field' }, h('label', null, 'To', to)), h('div', { class: 'field' }, h('label', null, 'What', type))),
    h('div', { class: 'row' }, btnX, btnC), h('p', { class: 'small muted' }, 'Exports are calculated on the server from your saved entries and are recorded in the audit log. Up to 400 days per export.')));
}
