import { h, mount, money, num, cls, fmtDate, addDays, tile, table, badge, icon } from '../ui.js';
import { api, state, todayLocal, navigate, can } from '../api.js';
import { barChart, profitChart, hbarChart, legend, loadChartLib } from '../charts.js';

export function presetRange(preset, today) {
  const m = today.slice(0, 8);
  switch (preset) {
    case 'today': return [today, today];
    case 'yesterday': return [addDays(today, -1), addDays(today, -1)];
    case '7d': return [addDays(today, -6), today];
    case '30d': return [addDays(today, -29), today];
    case 'month': return [m + '01', today];
    case 'lastmonth': { const end = addDays(m + '01', -1); return [end.slice(0, 8) + '01', end]; }
    case '90d': return [addDays(today, -89), today];
    default: return [addDays(today, -29), today];
  }
}

export async function dashboardPage(main, params) {
  const today = state.today || todayLocal();
  const preset = params.get('p') || (params.get('from') ? 'custom' : '30d');
  const [from, to] = preset === 'custom' ? [params.get('from') || addDays(today, -29), params.get('to') || today] : presetRange(preset, today);
  const span = (Date.parse(to) - Date.parse(from)) / 86400000;
  const group = params.get('g') || (span > 120 ? 'month' : span > 45 ? 'week' : 'day');
  const set = (o) => { const q = new URLSearchParams({ p: preset, g: group, ...(preset === 'custom' ? { from, to } : {}), ...o }); navigate('#/dashboard?' + q); };

  const data = await api(`/api/c/reports/summary?from=${from}&to=${to}&group=${group}`);
  const t = data.totals;

  const presets = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['90d', '90 days']];
  const fIn = h('input', { type: 'date', value: from }), tIn = h('input', { type: 'date', value: to });
  const custom = h('details', { class: 'small', open: preset === 'custom' ? true : null }, h('summary', null, 'Custom dates'),
    h('div', { class: 'row', style: { marginTop: '8px' } }, fIn, h('span', { class: 'muted' }, 'to'), tIn, h('button', { class: 'small primary', onclick: () => set({ p: 'custom', from: fIn.value, to: tIn.value }) }, 'Apply')));
  const filters = h('div', { class: 'noprint', style: { marginBottom: '16px', display: 'grid', gap: '10px' } },
    h('div', { class: 'spread' },
      h('div', { class: 'scroll-x' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Date range' }, presets.map(([k, l]) => h('button', { class: preset === k ? 'on' : '', onclick: () => set({ p: k, g: '' }) }, l)))),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Group by' }, [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => h('button', { class: group === k ? 'on' : '', onclick: () => set({ g: k }) }, l)))),
    custom);

  const pr = t.profit;
  const profitTile = pr.status === 'no_activity' ? tile('Profit', '—', 'No entries')
    : pr.status === 'unavailable' ? tile('Profit', h('span', { class: 'muted', style: { fontSize: '1rem' } }, 'Not yet'), pr.note)
    : tile(pr.status === 'actual' ? 'Net profit' : 'Net profit (partial)', h('span', { class: cls(pr.net) }, money(pr.net)), pr.note, 'hl');

  const tiles = h('div', { class: 'tiles' },
    tile('Collections', money(t.collections), t.credit_sales ? `incl. ${money(t.credit_sales)} udhaar` : `${t.days} days`),
    tile('Purchases', money(t.purchases), `${num(t.purchased_pieces)} pieces bought`),
    tile('Expenses', money(t.expenses)),
    tile('Net cash flow', h('span', { class: cls(t.net_cash_flow) }, money(t.net_cash_flow)), 'Money received − money paid'),
    profitTile,
    tile('Pieces sold', num(t.sold_pieces_known), 'From closing stock counts'),
    tile('Stock value', money(t.closing_stock_value), `on ${fmtDate(to)}`),
    tile('To pay (suppliers)', money(t.outstanding.payable)),
    tile('To receive (udhaar)', money(t.outstanding.receivable)),
    tile('Cash difference', h('span', { class: cls(t.cash_difference_total) }, money(t.cash_difference_total, { sign: true })), 'Counted − expected, total'));

  const labels = data.series.map((s) => (group === 'month' ? new Date(s.period + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : fmtDate(s.period, { day: 'numeric', month: 'short' })));
  const c1 = h('canvas', { role: 'img', 'aria-label': 'Collections, purchases and expenses by period' });
  const c2 = h('canvas', { role: 'img', 'aria-label': 'Net profit by period' });
  const c3 = h('canvas', { role: 'img', 'aria-label': 'Pieces bought and sold by period' });
  const c4 = h('canvas', { role: 'img', 'aria-label': 'Expenses by category' });
  const cssv = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const moneyTable = table(['Period', 'Collections', 'Purchases', 'Expenses', 'Net cash', 'Profit'], data.series.map((s, i) => h('tr', null,
    h('td', null, labels[i]), h('td', { class: 'num' }, money(s.collections)), h('td', { class: 'num' }, money(s.purchases)), h('td', { class: 'num' }, money(s.expenses)),
    h('td', { class: 'num ' + cls(s.net_cash_flow) }, money(s.net_cash_flow)),
    h('td', { class: 'num' }, s.profit_days ? h('span', { class: cls(s.profit_net) }, money(s.profit_net), s.profit_days < s.active_days ? h('span', { class: 'muted small' }, ` (${s.profit_days}/${s.active_days}d)`) : '') : '—'))));
  moneyTable.classList.add('hidden');
  const toggle = h('button', { class: 'small', onclick: () => { moneyTable.classList.toggle('hidden'); c1.parentElement.classList.toggle('hidden'); toggle.textContent = moneyTable.classList.contains('hidden') ? 'Table view' : 'Chart view'; } }, 'Table view');

  const discrepancies = data.discrepancies.length ? h('div', { class: 'card' }, h('h2', null, `Discrepancies (${t.discrepancy_count})`),
    table(['Date', 'Issue'], data.discrepancies.slice().reverse().slice(0, 30).map((d) => h('tr', null,
      h('td', null, h('a', { href: `#/day?date=${d.date}` }, fmtDate(d.date))), h('td', null, badge(d.severity === 'error' ? 'High' : 'Check', d.severity === 'error' ? 'bad' : 'warn'), ' ', d.message))))) : null;

  mount(main,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Dashboard'), h('div', { class: 'sub' }, `${fmtDate(from)} – ${fmtDate(to)}`)),
      can('entries.write') ? h('a', { class: 'btn primary desk-only', href: `#/day?date=${today}` }, icon('plus', 17), 'Today’s entry') : null),
    filters, tiles,
    h('div', { class: 'card' }, h('div', { class: 'spread' }, h('h2', { style: { margin: 0 } }, 'Collections, purchases & expenses'), toggle),
      legend([['Collections', cssv('--series-1')], ['Purchases', cssv('--series-2')], ['Expenses', cssv('--series-3')]]),
      h('div', { class: 'chart' }, c1), moneyTable),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', null, 'Profit & loss'),
        h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Only days with a complete closing stock count are included. Blue = profit, orange = loss.'),
        h('div', { class: 'chart' }, c2)),
      h('div', { class: 'card' }, h('h2', null, 'Inventory movement (pieces)'),
        legend([['Bought', cssv('--series-1')], ['Sold (counted)', cssv('--series-2')]]),
        h('div', { class: 'chart' }, c3))),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', null, 'Expenses by category'),
        data.expenses_by_category.length ? h('div', { class: 'chart', style: { height: Math.max(160, data.expenses_by_category.length * 34) + 'px' } }, c4) : h('div', { class: 'empty' }, 'No expenses in this period')),
      h('div', { class: 'card' }, h('h2', null, 'Stock summary'),
        table(['Item', 'Opening', 'Bought', 'Sold', 'Closing'], t.products.map((p) => h('tr', null, h('td', null, p.name), h('td', { class: 'num' }, num(p.opening)),
          h('td', { class: 'num' }, num(p.purchased)), h('td', { class: 'num' }, num(p.sold_known)), h('td', { class: 'num' }, num(p.closing), p.closing_counted ? '' : h('span', { class: 'muted small' }, ' est.')))), { empty: 'No stock movement' }))),
    discrepancies);

  const draw = () => {
    barChart(c1, labels, [{ label: 'Collections', data: data.series.map((s) => s.collections) }, { label: 'Purchases', data: data.series.map((s) => s.purchases) }, { label: 'Expenses', data: data.series.map((s) => s.expenses) }]);
    profitChart(c2, labels, data.series.map((s) => (s.profit_days ? s.profit_net : null)));
    barChart(c3, labels, [{ label: 'Bought', data: data.series.map((s) => s.purchased_pieces) }, { label: 'Sold (counted)', data: data.series.map((s) => s.sold_pieces) }], { money: false });
    if (data.expenses_by_category.length) hbarChart(c4, data.expenses_by_category.map((e) => e.category), data.expenses_by_category.map((e) => e.amount));
  };
  loadChartLib().then(draw);
}
