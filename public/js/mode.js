// Experience modes: how much of the app a person sees. Saved per user on this device.
//   layman - only what a first-time user needs: quick add, today, settings
//   smart  - the everyday toolkit: dashboard, products, reports, udhaar
//   nerdy  - everything: stock counts, cash checks, profit maths, audit log
import { h, icon, modal } from './ui.js';

export const MODES = [
  { id: 'layman', label: 'Layman', icon: 'sparkles', tag: 'Super simple', desc: 'Big buttons. Add a sale, a purchase or an expense in seconds. Nothing else.' },
  { id: 'smart', label: 'Smart', icon: 'chart', tag: 'Balanced', desc: 'Daily entry, dashboard, products, reports and udhaar — without the technical extras.' },
  { id: 'nerdy', label: 'Nerdy', icon: 'code', tag: 'Everything', desc: 'All numbers and controls: stock counts, cash checks, profit workings, audit log.' },
];

let userKey = 'anon';
const key = () => `dk_mode_${userKey}`;

export function initMode(user) {
  userKey = user?.id ?? user?.email ?? 'anon';
  applyMode(getMode());
}
export function getMode() {
  try { const m = localStorage.getItem(key()); return MODES.some((x) => x.id === m) ? m : null; } catch { return null; }
}
export const modeOrDefault = () => getMode() || 'smart';
export function applyMode(m) { document.documentElement.dataset.mode = m || 'smart'; }
export function setMode(m) {
  try { localStorage.setItem(key(), m); } catch { /* storage blocked: mode lasts until reload */ }
  applyMode(m);
  window.dispatchEvent(new Event('modechange'));
}

/** Mode picker cards. `onPick` runs after the mode is saved. */
export function modeCards(current, onPick) {
  return h('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Experience mode' }, MODES.map((m) =>
    h('button', { type: 'button', class: 'modecard' + (current === m.id ? ' on' : ''), role: 'radio', 'aria-checked': current === m.id ? 'true' : 'false', onclick: () => { setMode(m.id); onPick?.(m.id); } },
      h('span', { class: 'dot' }, icon(m.icon)),
      h('span', { class: 'txt' }, h('span', { class: 't' }, m.label, h('span', { class: 'tag' }, m.tag)), h('span', { class: 'd' }, m.desc)),
      h('span', { class: 'tick' }, current === m.id ? icon('check', 18) : null))));
}

/** Bottom sheet to switch mode at any time. */
export function openModeSheet() {
  const m = modal('How do you want to use DailyKhata?', h('div', null,
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'You can change this any time. Your data is the same in every mode.'),
    modeCards(getMode(), () => m.close())));
  return m;
}

/** First-run welcome: asks once, remembers the answer. */
export function welcomeModePicker(onDone) {
  const m = modal('Welcome! Pick your style', h('div', null,
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'New to apps like this? Choose Layman — you can switch later in Settings.'),
    modeCards(null, () => { m.close(); onDone?.(); })));
  return m;
}
