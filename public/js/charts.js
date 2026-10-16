// Chart.js wrappers following one visual system: categorical slots in fixed order, thin marks,
// recessive grid, single y-axis per chart, legends for >= 2 series, hover tooltips.
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const charts = new Set();

export function destroyCharts() { for (const c of charts) c.destroy(); charts.clear(); }
window.addEventListener('hashchange', destroyCharts);

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rs = (paise) => '₹' + inr.format(paise / 100);

function base(yFmt) {
  const text2 = css('--text-2'), grid = css('--grid');
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${yFmt(ctx.parsed.y ?? ctx.parsed.x)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: text2, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, border: { color: grid } },
      y: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: text2, callback: (v) => yFmt(v) } },
    },
  };
}

export function legend(items) {
  const el = document.createElement('div'); el.className = 'legend';
  for (const [label, color] of items) {
    const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = color; s.append(i, label); el.append(s);
  }
  return el;
}

function make(canvas, config) {
  if (!window.Chart) { canvas.replaceWith(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Charts unavailable offline — see the table view.' })); return null; }
  const c = new window.Chart(canvas, config); charts.add(c); return c;
}

/** Grouped bars: one colour per series in fixed slot order. series: [{label, data(paise)}] */
export function barChart(canvas, labels, series, { money = true } = {}) {
  const colors = [css('--series-1'), css('--series-2'), css('--series-3')];
  const fmt = money ? rs : (v) => inr.format(v);
  return make(canvas, {
    type: 'bar',
    data: { labels, datasets: series.map((s, i) => ({ label: s.label, data: s.data, backgroundColor: s.color || colors[i], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28, categoryPercentage: 0.7, barPercentage: 0.9, borderColor: css('--surface'), borderWidth: { left: 1, right: 1 } })) },
    options: base(fmt),
  });
}

/** Single-series profit bars: positive in series-1, losses in series-2 (with legend explaining). */
export function profitChart(canvas, labels, values) {
  const pos = css('--series-1'), neg = css('--series-2');
  return make(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Net profit', data: values, backgroundColor: values.map((v) => (v === null ? 'transparent' : v < 0 ? neg : pos)), borderRadius: 4, maxBarThickness: 28 }] },
    options: base(rs),
  });
}

export function hbarChart(canvas, labels, values) {
  const o = base(rs);
  o.indexAxis = 'y'; o.interaction = { mode: 'nearest', axis: 'y', intersect: false };
  o.plugins.tooltip.callbacks.label = (ctx) => `${ctx.label}: ${rs(ctx.parsed.x)}`;
  o.scales = { x: { beginAtZero: true, grid: { color: css('--grid') }, border: { display: false }, ticks: { color: css('--text-2'), callback: (v) => rs(v) } },
    y: { grid: { display: false }, ticks: { color: css('--text-2') }, border: { color: css('--grid') } } };
  return make(canvas, { type: 'bar', data: { labels, datasets: [{ label: 'Expenses', data: values, backgroundColor: css('--series-2'), borderRadius: 4, maxBarThickness: 22 }] }, options: o });
}
