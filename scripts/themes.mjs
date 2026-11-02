// Art styles for Settings > Style. Each style = a colour set (checked for contrast in test/styles.test.ts)
// plus its own decorations. build-client.mjs writes them to public/css/themes.css (git-ignored), which boot.js
// loads only for people who picked one of these styles. In the CSS strings `&` stands for the style's root selector.
// Component rules are wrapped in :where(&) so they keep the specificity of the base rules in app.css and win by
// coming later; colour tokens use the full selector so they beat app.css's dark-mode tokens.

import { STYLES } from '../public/js/styles.js';

const svg = (s) => `url("data:image/svg+xml,${s.replace(/\s+/g, ' ').replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

// summary cells (Home: .qcell, Today: .daysum > div) painted as three blocks; [background, text] pairs are kept for the contrast test
export const CELL_PAIRS = [];
const cells = (a, b, c, extra = '') => { CELL_PAIRS.push(a, b, c); return `
:where(&) .qsum, :where(&) .daysum { background: transparent; border: 0; box-shadow: none; gap: 10px; overflow: visible; border-radius: 0; }
:where(&) .qcell, :where(&) .daysum > div { border: 0; ${extra} }
:where(&) .qcell .k, :where(&) .daysum .k, :where(&) .qcell .v, :where(&) .daysum .v, :where(&) .daysum .v.pos, :where(&) .daysum .v.neg { color: inherit; }
:where(&) .qcell:nth-child(1), :where(&) .daysum > div:nth-child(1) { background: ${a[0]}; color: ${a[1]}; }
:where(&) .qcell:nth-child(2), :where(&) .daysum > div:nth-child(2) { background: ${b[0]}; color: ${b[1]}; }
:where(&) .qcell:nth-child(3), :where(&) .daysum > div:nth-child(3) { background: ${c[0]}; color: ${c[1]}; }`; };
// a dark bar (phone top bar and tab bar) with light text
// (lite mode swaps bar backgrounds for --surface with !important, so give it the bar's solid colour back)
const darkBars = (bg, fg, active, extra = '', solid = bg) => `
:where(&) .topbar, :where(&) .tabbar { background: ${bg}; border-color: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; ${extra} }
&.lite .topbar, &.lite .tabbar { background: ${solid} !important; }
:where(&) .topbar .title, :where(&) .tabbar a, :where(&) .tabbar button:not(.fab) { color: ${fg}; }
:where(&) .tabbar a.active { color: ${active}; }`;
const darkTabbar = (bg, fg, active) => `
:where(&) .tabbar { background: ${bg}; border-color: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; }
&.lite .tabbar { background: ${bg} !important; }
:where(&) .tabbar a, :where(&) .tabbar button:not(.fab) { color: ${fg}; }
:where(&) .tabbar a.active { color: ${active}; }`;
const SURFACES = ':where(&) .card, :where(&) .tile, :where(&) .strip, :where(&) .qtool, :where(&) .notecard, :where(&) .ctile, :where(&) .cpanel, :where(&) .modal, :where(&) .qsum, :where(&) .daysum';
const BUTTON = ':where(&) button, :where(&) .btn';
const PRIMARY = ':where(&) button.primary, :where(&) .btn.primary';
const FIELDS = ':where(&) input, :where(&) select, :where(&) textarea';
const H1 = ':where(&) .page-head h1, :where(&) .qhead h1';
const FAB = ':where(&) .tabbar .fab span.ring';

export const THEMES = [
  {
    id: 'skeuo',
    t: { bg: '#e6ddc8', surface: '#fbf7ee', surface2: '#f2ead9', surface3: '#e6dcc6', border: 'rgba(70,48,25,.22)', borderStrong: 'rgba(70,48,25,.38)', text: '#2b2318', text2: '#4e4232', muted: '#665845', field: '#8a7a62', good: '#295c25', bad: '#9b241c', warn: '#764600', brand: '#3f7a3a', onBrand: '#ffffff', brandFg: '#2f5f2b', accent: '#b07a2a', radius: '14px', radiusSm: '10px' },
    css: `
:where(&) body { background: repeating-linear-gradient(0deg, rgba(90,70,40,.06) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(90,70,40,.05) 0 1px, transparent 1px 3px), var(--bg); }
${darkBars('linear-gradient(180deg,#6b4a2f,#4a311d)', '#f6ecd8', '#ffd98a', 'outline: 1.5px dashed rgba(246,236,216,.4); outline-offset: -6px; box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 2px 8px rgba(0,0,0,.35);', '#553a23')}
${SURFACES} { background-color: #fbf7ee; background-image: linear-gradient(180deg,#fffdf7,#f4ecdb); border: 1px solid rgba(70,48,25,.28); box-shadow: inset 0 1px 0 #fff, 0 1px 0 rgba(70,48,25,.1), 0 6px 14px -6px rgba(60,40,20,.35); }
:where(&) .card { outline: 1.5px dashed rgba(90,60,30,.28); outline-offset: -7px; }
${BUTTON} { background: linear-gradient(180deg,#ffffff,#e9e1cf); border: 1px solid #a89574; box-shadow: inset 0 1px 0 #fff, 0 1px 2px rgba(0,0,0,.2); }
${PRIMARY} { background: linear-gradient(180deg,#5fa15a,#3f7a3a 55%,#2f5f2b); border: 1px solid #244a21; color: #fff; text-shadow: 0 -1px 0 rgba(0,0,0,.35); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 2px 3px rgba(0,0,0,.3); }
${FIELDS} { background: #fffdf8; border-color: #a89574; box-shadow: inset 0 2px 3px rgba(60,40,20,.16); }
:where(&) .chip.on { background: linear-gradient(180deg,#5fa15a,#3f7a3a); color: #fff; border-color: #244a21; }
${H1} { color: #3a2a18; text-shadow: 0 1px 0 #fff; }
${FAB} { background: radial-gradient(circle at 35% 30%, #8fd486, #3f7a3a 60%, #24481f); box-shadow: inset 0 2px 0 rgba(255,255,255,.4), 0 6px 12px rgba(0,0,0,.35); }`,
  },
  {
    id: 'nouveau',
    t: { bg: '#f1e6cf', surface: '#fbf5e6', surface2: '#f4ead3', surface3: '#eadcbd', border: 'rgba(36,64,47,.18)', borderStrong: 'rgba(36,64,47,.35)', text: '#1f2a24', text2: '#3e4a40', muted: '#5a5f4c', field: '#8c8468', good: '#2b6039', bad: '#942d20', warn: '#7c4a00', brand: '#24402f', onBrand: '#fbf5e6', brandFg: '#2c5a3e', accent: '#b8892d', radius: '30px', radiusSm: '16px' },
    css: `
:where(&) body { background: ${svg('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><path d="M0 130C45 130 45 45 90 45s45 85 90 85" fill="none" stroke="#b8892d" stroke-opacity=".22" stroke-width="1.5"/><path d="M0 165C55 165 35 100 90 100s35 65 90 65" fill="none" stroke="#24402f" stroke-opacity=".12"/></svg>')}, var(--bg); }
${darkBars('#24402f', '#f3e8cc', '#e9c46a', 'border-bottom: 2px solid #b8892d;')}
${SURFACES} { border: 1px solid #b8892d; box-shadow: inset 0 0 0 4px var(--surface), inset 0 0 0 5px rgba(184,137,45,.5); }
:where(&) .card, :where(&) .tile, :where(&) .notecard { border-radius: 34px 10px 34px 10px; }
${BUTTON} { border-radius: 999px; border: 1px solid #b8892d; background: #fbf5e6; }
${PRIMARY} { background: #24402f; color: #fbf5e6; border-color: #b8892d; box-shadow: inset 0 0 0 2px #24402f, inset 0 0 0 3px #b8892d; }
:where(&) .chip.on { background: #24402f; color: #fbf5e6; border-color: #b8892d; }
${H1} { font-family: var(--serif); font-weight: 400; letter-spacing: .01em; color: #24402f; }
:where(&) .page-head h1::after { content: "\\2766"; color: #b8892d; margin-left: .3em; font-size: .55em; vertical-align: middle; }
${FAB} { background: radial-gradient(circle at 40% 35%, #3f6b4f, #24402f 70%); box-shadow: 0 0 0 3px #b8892d, 0 8px 16px rgba(36,64,47,.35); }`,
  },
  {
    id: 'chrome',
    t: { bg: '#cdd2d9', surface: '#f4f6f8', surface2: '#e6e9ee', surface3: '#d6dae1', border: 'rgba(20,24,30,.18)', borderStrong: 'rgba(20,24,30,.32)', text: '#111419', text2: '#2f353e', muted: '#4a515c', field: '#6c737e', good: '#17593a', bad: '#8f1e1e', warn: '#704300', brand: '#1b1f26', onBrand: '#f4f6f8', brandFg: '#1f2937', accent: '#8d96a3', radius: '20px', radiusSm: '14px' },
    css: `
:where(&) body { background: linear-gradient(160deg,#e9ecf0 0%,#c3c9d2 35%,#f2f4f7 55%,#b7bec8 80%,#dfe3e8 100%) fixed; }
:where(&) .topbar, :where(&) .tabbar { background: linear-gradient(180deg,#fdfdfe,#c9ced6 50%,#eef0f3); border-color: #9aa2ad; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: inset 0 1px 0 #fff, 0 6px 16px -8px rgba(20,24,30,.5); }
${SURFACES} { background-color: #f4f6f8; background-image: linear-gradient(145deg,#ffffff 0%,#e4e8ed 45%,#fafbfc 60%,#d9dde3 100%); border: 1px solid rgba(255,255,255,.9); box-shadow: inset 0 1px 0 #fff, inset 0 -1px 0 rgba(0,0,0,.08), 0 10px 24px -14px rgba(20,24,30,.55); }
${BUTTON} { border-radius: 999px; background: linear-gradient(180deg,#ffffff,#d7dce3 50%,#f3f5f7); border: 1px solid #9aa2ad; box-shadow: inset 0 1px 0 #fff; }
${PRIMARY} { background: linear-gradient(180deg,#4b525d,#1b1f26 50%,#2c323b); color: #f4f6f8; border: 1px solid #0b0d10; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 4px 10px -4px rgba(0,0,0,.5); }
:where(&) .chip.on { background: linear-gradient(180deg,#4b525d,#1b1f26); color: #f4f6f8; border-color: #0b0d10; }
${H1} { background: linear-gradient(180deg,#6b7480,#111419 60%,#3c434d); -webkit-background-clip: text; background-clip: text; color: #111419; -webkit-text-fill-color: transparent; }
${FAB} { background: conic-gradient(from 210deg,#c3cfe2,#f5d0e6,#cfe9f3,#e3f3c8,#c3cfe2); color: #1b1f26; box-shadow: inset 0 2px 6px rgba(255,255,255,.9), 0 8px 18px rgba(20,24,30,.35); }`,
  },
  {
    id: 'stijl',
    t: { bg: '#ffffff', surface: '#ffffff', surface2: '#f2f2f2', surface3: '#e6e6e6', border: '#111111', borderStrong: '#111111', text: '#111111', text2: '#2b2b2b', muted: '#444444', field: '#111111', good: '#0e6633', bad: '#a61d17', warn: '#834e00', brand: '#1f4aa8', onBrand: '#ffffff', brandFg: '#1f4aa8', accent: '#f2c230', radius: '0px', radiusSm: '0px' },
    css: `
:where(&) .topbar { background: #fff; border-bottom: 6px solid #111; -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .tabbar { background: #fff; border: 5px solid #111; border-radius: 0; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: none; }
:where(&) .tabbar a.active { background: #f2c230; color: #111; }
${SURFACES} { border: 5px solid #111; border-radius: 0; box-shadow: none; }
${cells(['#d42a20', '#ffffff'], ['#f2c230', '#111111'], ['#1f4aa8', '#ffffff'], 'border-radius: 0;')}
:where(&) .qsum, :where(&) .daysum { gap: 5px; background: #111; border: 5px solid #111; }
${BUTTON} { border: 3px solid #111; border-radius: 0; background: #fff; font-weight: 700; box-shadow: none; }
${PRIMARY} { background: #1f4aa8; color: #fff; border-color: #111; }
:where(&) .chip.on { background: #d42a20; color: #fff; border: 3px solid #111; }
${FIELDS} { border: 3px solid #111; border-radius: 0; }
${H1} { text-transform: uppercase; font-weight: 800; letter-spacing: -.02em; }
:where(&) .page-head h1::before { content: ""; display: inline-block; width: .55em; height: .55em; background: #d42a20; margin-right: .3em; vertical-align: .05em; }
${FAB} { border-radius: 0; background: #f2c230; color: #111; border: 4px solid #111; box-shadow: none; }`,
  },
  {
    id: 'memphis',
    t: { bg: '#fff6e9', surface: '#ffffff', surface2: '#fff1db', surface3: '#ffe3b8', border: '#111111', borderStrong: '#111111', text: '#141414', text2: '#2e2a2a', muted: '#4d4646', field: '#111111', good: '#0a6447', bad: '#a81f33', warn: '#834e00', brand: '#ff6fae', onBrand: '#141414', brandFg: '#b0215f', accent: '#00b3a7', radius: '18px', radiusSm: '12px' },
    css: `
:where(&) body { background: ${svg('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><path d="M20 40q10-14 20 0t20 0 20 0" fill="none" stroke="#00b3a7" stroke-width="4" stroke-linecap="round" opacity=".45"/><path d="M150 30l18 30h-36z" fill="#ffd23f" opacity=".55"/><circle cx="170" cy="150" r="12" fill="none" stroke="#ff6fae" stroke-width="4" opacity=".5"/><g fill="#7b5cff" opacity=".35"><circle cx="40" cy="160" r="3"/><circle cx="55" cy="170" r="3"/><circle cx="70" cy="160" r="3"/><circle cx="55" cy="150" r="3"/></g><rect x="100" y="110" width="22" height="22" fill="none" stroke="#111" stroke-width="3" opacity=".25" transform="rotate(20 111 121)"/></svg>')}, var(--bg); }
:where(&) .topbar { background: #fff; border-bottom: 3px solid #111; -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .tabbar { background: #ffd23f; border: 2.5px solid #111; box-shadow: 5px 5px 0 #111; -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .tabbar a, :where(&) .tabbar button:not(.fab) { color: #141414; }
${SURFACES} { border: 2.5px solid #111; box-shadow: 6px 6px 0 #111; }
${cells(['#ff6fae', '#141414'], ['#00b3a7', '#141414'], ['#ffd23f', '#141414'], 'border: 2.5px solid #111 !important; box-shadow: 4px 4px 0 #111; border-radius: 16px;')}
${BUTTON} { border: 2.5px solid #111; border-radius: 12px; background: #fff; box-shadow: 3px 3px 0 #111; }
:where(&) button:active, :where(&) .btn:active { transform: translate(3px,3px); box-shadow: none; }
${PRIMARY} { background: #ff6fae; color: #141414; border-color: #111; }
:where(&) .chip.on { background: #00b3a7; color: #141414; border: 2.5px solid #111; }
${FIELDS} { border: 2.5px solid #111; }
${H1} { font-weight: 800; text-shadow: 3px 3px 0 #ffd23f; }
${FAB} { background: #7b5cff; color: #fff; border: 3px solid #111; box-shadow: 4px 4px 0 #111; }
&.lite .card, &.lite .tile, &.lite .modal { box-shadow: 6px 6px 0 #111 !important; }`,
  },
  {
    id: 'psych',
    t: { bg: '#2a0b45', surface: '#3a1160', surface2: '#471573', surface3: '#561a88', border: 'rgba(255,214,150,.28)', borderStrong: 'rgba(255,214,150,.45)', text: '#fff4e0', text2: '#f3d9ff', muted: '#e0c2f5', field: '#c79ee6', good: '#7cf2c8', bad: '#ffa39e', warn: '#ffd27a', brand: '#ff9f1c', onBrand: '#2a0b45', brandFg: '#ffb14a', accent: '#ff5ea8', radius: '28px', radiusSm: '18px' },
    css: `
:where(&) body { background: radial-gradient(circle at 15% 10%, rgba(255,94,168,.5) 0, transparent 34%), radial-gradient(circle at 90% 35%, rgba(255,159,28,.4) 0, transparent 32%), radial-gradient(circle at 40% 90%, rgba(124,242,200,.3) 0, transparent 36%), repeating-radial-gradient(circle at 50% 120%, #2a0b45 0 26px, #3a0f6a 26px 52px), #2a0b45; background-attachment: fixed; }
:where(&) .topbar, :where(&) .tabbar { background: rgba(42,11,69,.85); border-color: rgba(255,159,28,.5); }
${SURFACES} { background-color: rgba(58,17,96,.92); border: 1.5px solid rgba(255,214,150,.4); }
:where(&) .card, :where(&) .tile, :where(&) .notecard { border-radius: 30px 30px 30px 8px; }
${BUTTON} { background: rgba(255,255,255,.08); border: 1.5px solid rgba(255,214,150,.5); color: #fff4e0; border-radius: 999px; }
${PRIMARY} { background: linear-gradient(90deg,#ff9f1c,#ff5ea8); color: #2a0b45; border-color: transparent; }
:where(&) .chip.on { background: linear-gradient(90deg,#7cf2c8,#ff9f1c); color: #2a0b45; border-color: transparent; }
${FIELDS} { background: rgba(255,255,255,.07); border-color: #c79ee6; color: #fff4e0; }
${H1} { font-family: var(--serif); background: linear-gradient(90deg,#ff9f1c,#ff5ea8,#7cf2c8); -webkit-background-clip: text; background-clip: text; color: #fff4e0; -webkit-text-fill-color: transparent; }
${FAB} { background: conic-gradient(#ff9f1c,#ff5ea8,#b967ff,#7cf2c8,#ff9f1c); color: #2a0b45; }`,
  },
  {
    id: 'vapor',
    t: { bg: '#1a103d', surface: '#261650', surface2: '#2f1c63', surface3: '#3a2378', border: 'rgba(1,205,254,.35)', borderStrong: 'rgba(1,205,254,.6)', text: '#f7f0ff', text2: '#e3d6ff', muted: '#c7b6f2', field: '#9d8fd6', good: '#05ffa1', bad: '#ff8fa3', warn: '#ffd27a', brand: '#ff71ce', onBrand: '#1a103d', brandFg: '#ff9ade', accent: '#01cdfe', radius: '6px', radiusSm: '4px' },
    css: `
:where(&) body { background: repeating-linear-gradient(90deg, rgba(1,205,254,.16) 0 1px, transparent 1px 56px) bottom / 100% 38% no-repeat, repeating-linear-gradient(0deg, rgba(1,205,254,.16) 0 1px, transparent 1px 28px) bottom / 100% 38% no-repeat, radial-gradient(circle at 50% 64%, rgba(255,184,107,.55) 0 70px, rgba(255,113,206,.35) 71px 120px, transparent 121px), linear-gradient(180deg, #1a103d 0%, #2b1460 45%, #4d1a66 66%, #1a103d 100%); background-attachment: fixed; }
:where(&) .topbar { background: rgba(26,16,61,.88); border-bottom: 1px solid #ff71ce; }
:where(&) .tabbar { background: rgba(26,16,61,.9); border: 1px solid #01cdfe; box-shadow: 0 0 18px rgba(1,205,254,.35); }
${SURFACES} { background-color: rgba(38,22,80,.9); border: 1px solid rgba(1,205,254,.45); box-shadow: 0 0 0 1px rgba(255,113,206,.25), 0 0 18px rgba(1,205,254,.16); }
${BUTTON} { background: transparent; border: 1px solid #01cdfe; color: #f7f0ff; box-shadow: 0 0 8px rgba(1,205,254,.35); }
${PRIMARY} { background: linear-gradient(90deg,#ff71ce,#b967ff); color: #1a103d; border-color: transparent; box-shadow: 0 0 14px rgba(255,113,206,.5); }
:where(&) .chip.on { background: #01cdfe; color: #1a103d; border-color: transparent; }
${FIELDS} { background: rgba(255,255,255,.05); border-color: #9d8fd6; color: #f7f0ff; }
${H1} { text-transform: uppercase; letter-spacing: .08em; font-style: italic; color: #f7f0ff; text-shadow: 2px 2px 0 #ff71ce, -2px -2px 0 rgba(1,205,254,.8); }
${FAB} { background: linear-gradient(180deg,#ffb86b,#ff71ce 50%,#b967ff); color: #1a103d; box-shadow: 0 0 20px rgba(255,113,206,.6); }`,
  },
  {
    id: 'steam',
    t: { bg: '#d9c59a', surface: '#f3e7c9', surface2: '#eadcb8', surface3: '#e0cea4', border: 'rgba(90,58,34,.25)', borderStrong: 'rgba(90,58,34,.45)', text: '#2a1c10', text2: '#4a3722', muted: '#5e4a30', field: '#8a6f48', good: '#264e28', bad: '#852215', warn: '#653d00', brand: '#7a4b1f', onBrand: '#f7ecd2', brandFg: '#6b3f17', accent: '#c9a043', radius: '10px', radiusSm: '8px' },
    css: `
:where(&) body { background: radial-gradient(circle at 15% 20%, rgba(120,80,30,.18) 0, transparent 30%), radial-gradient(circle at 85% 75%, rgba(120,80,30,.16) 0, transparent 28%), var(--bg); }
${darkBars('repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 2px, transparent 2px 7px), linear-gradient(180deg,#5a3a22,#3b2615)', '#f3e2b8', '#ffd66b', 'border-bottom: 3px solid #c9a043;', '#4a301b')}
${SURFACES} { border: 3px double #a5802e; box-shadow: inset 0 0 22px rgba(120,80,30,.16), 0 3px 0 #8a6a2a, 0 8px 16px -8px rgba(40,25,10,.5); }
:where(&) .card, :where(&) .tile, :where(&) .strip { background-image: radial-gradient(circle at 10px 10px, #c9a043 2.5px, transparent 3px), radial-gradient(circle at calc(100% - 10px) 10px, #c9a043 2.5px, transparent 3px), radial-gradient(circle at 10px calc(100% - 10px), #c9a043 2.5px, transparent 3px), radial-gradient(circle at calc(100% - 10px) calc(100% - 10px), #c9a043 2.5px, transparent 3px); }
${BUTTON} { background: linear-gradient(180deg,#f0d58f,#c9a043 45%,#a8842f); border: 1px solid #6e531c; color: #2a1c10; box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 2px 0 #5c4416; }
${PRIMARY} { background: linear-gradient(180deg,#a8683a,#7a4b1f 55%,#5c3714); color: #f7ecd2; border-color: #3b2615; }
:where(&) .chip.on { background: linear-gradient(180deg,#a8683a,#7a4b1f); color: #f7ecd2; border-color: #3b2615; }
${FIELDS} { background: #fbf3dc; border-color: #8a6f48; box-shadow: inset 0 2px 4px rgba(90,58,34,.18); }
${H1} { font-family: var(--serif); color: #3b2615; }
:where(&) .page-head h1::before { content: "\\2699"; color: #a5802e; margin-right: .25em; }
${FAB} { background: radial-gradient(circle at 35% 30%, #f5df9f, #c9a043 55%, #7d5f22); color: #2a1c10; box-shadow: 0 0 0 3px #5a3a22, 0 6px 12px rgba(0,0,0,.4); }`,
  },
  {
    id: 'grunge',
    t: { bg: '#1f1e1c', surface: '#2e2c29', surface2: '#383532', surface3: '#45413c', border: 'rgba(236,230,218,.18)', borderStrong: 'rgba(236,230,218,.32)', text: '#ece6da', text2: '#d8d0c0', muted: '#bdb3a0', field: '#8f8676', good: '#9fd58a', bad: '#ffb6a7', warn: '#ffd27a', brand: '#e0643f', onBrand: '#0d0b09', brandFg: '#ff9e7a', accent: '#e9e4d8', radius: '4px', radiusSm: '3px' },
    css: `
:where(&) body { background: ${svg('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}, var(--bg); }
:where(&) .topbar, :where(&) .tabbar { background: #141312; border-color: #e0643f; -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .topbar { border-bottom: 3px solid #e0643f; }
${SURFACES} { border: 1px solid rgba(236,230,218,.16); box-shadow: 2px 3px 0 rgba(0,0,0,.55); }
:where(&) .card, :where(&) .notecard { position: relative; }
:where(&) .card::before, :where(&) .notecard::before { content: ""; position: absolute; top: -9px; left: 22px; width: 78px; height: 18px; background: rgba(233,228,216,.5); transform: rotate(-4deg); box-shadow: 0 1px 2px rgba(0,0,0,.4); pointer-events: none; }
${BUTTON} { background: #1a1917; border: 2px solid #ece6da; border-radius: 2px; color: #ece6da; text-transform: uppercase; letter-spacing: .05em; }
${PRIMARY} { background: #e0643f; color: #0d0b09; border-color: #0d0b09; }
:where(&) .chip.on { background: #ece6da; color: #141312; border-color: #ece6da; }
${H1} { font-family: Impact, "Arial Black", var(--font); text-transform: uppercase; letter-spacing: .03em; font-weight: 400; transform: rotate(-1deg); text-shadow: 2px 2px 0 rgba(224,100,63,.55); }
${FAB} { border-radius: 10px; background: #e0643f; color: #0d0b09; box-shadow: 3px 3px 0 #000; }
&.lite .card, &.lite .tile, &.lite .modal { box-shadow: 2px 3px 0 rgba(0,0,0,.55) !important; }`,
  },
  {
    id: 'cutout',
    t: { bg: '#f6d9b4', surface: '#fffaf2', surface2: '#fdf0dc', surface3: '#f7e3c4', border: 'rgba(120,70,30,.14)', borderStrong: 'rgba(120,70,30,.28)', text: '#2d1f17', text2: '#4b3a2e', muted: '#6b5546', field: '#9b8370', good: '#1d5d44', bad: '#9a2e18', warn: '#7c4a00', brand: '#e86a4a', onBrand: '#2d1f17', brandFg: '#9c351b', accent: '#5bb39a', radius: '22px', radiusSm: '14px' },
    css: `
:where(&) body { background: radial-gradient(120% 60% at 50% 112%, #f2b98a 0 40%, transparent 40.5%), radial-gradient(120% 60% at 15% 120%, #e89a6a 0 38%, transparent 38.5%), var(--bg); background-attachment: fixed; }
:where(&) .topbar { background: #fffaf2; border-bottom: 0; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 3px 0 #f1cf9f, 0 6px 0 #e8b47a; }
:where(&) .tabbar { background: #fffaf2; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 -3px 0 #f1cf9f, 0 4px 0 #e8b47a, 0 10px 18px -8px rgba(110,60,20,.4); }
${SURFACES} { border: 0; box-shadow: 0 3px 0 #f1cf9f, 0 7px 0 #e8b47a, 0 14px 22px -8px rgba(110,60,20,.35); }
${cells(['#bfe6d6', '#2d1f17'], ['#ffc9b8', '#2d1f17'], ['#c7def7', '#2d1f17'], 'border-radius: 20px; box-shadow: 0 3px 0 rgba(0,0,0,.08), 0 6px 0 rgba(0,0,0,.06);')}
${BUTTON} { border: 0; background: #fff; border-radius: 14px; box-shadow: 0 3px 0 #e8b47a, 0 6px 10px -6px rgba(110,60,20,.4); }
:where(&) button:active, :where(&) .btn:active { transform: translateY(3px); box-shadow: none; }
${PRIMARY} { background: #e86a4a; color: #2d1f17; box-shadow: 0 4px 0 #b9532f, 0 8px 12px -6px rgba(110,60,20,.4); }
:where(&) .chip.on { background: #5bb39a; color: #2d1f17; box-shadow: 0 3px 0 #3e8a73; }
${H1} { font-family: var(--serif); color: #2d1f17; display: inline-block; background: linear-gradient(transparent 68%, #ffd8a8 68%); }
${FAB} { background: #e86a4a; color: #2d1f17; box-shadow: 0 0 0 5px #fffaf2, 0 0 0 9px #5bb39a, 0 8px 14px rgba(0,0,0,.25); }`,
  },
  {
    id: 'glitch',
    t: { bg: '#0b0b12', surface: '#14141f', surface2: '#1b1b29', surface3: '#23233a', border: 'rgba(5,217,232,.35)', borderStrong: 'rgba(5,217,232,.6)', text: '#e8f7ff', text2: '#c9e3ef', muted: '#9fc0cf', field: '#5f7f8f', good: '#3dffb0', bad: '#ff6b8f', warn: '#ffd27a', brand: '#05d9e8', onBrand: '#0b0b12', brandFg: '#05d9e8', accent: '#ff2a6d', radius: '2px', radiusSm: '2px' },
    css: `
:where(&) body { background: repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), var(--bg); }
:where(&) .topbar, :where(&) .tabbar { background: #0b0b12; border-color: #ff2a6d; -webkit-backdrop-filter: none; backdrop-filter: none; }
${SURFACES} { border: 1px solid rgba(5,217,232,.4); box-shadow: 3px 0 0 rgba(255,42,109,.55), -3px 0 0 rgba(5,217,232,.35); }
${BUTTON} { font-family: ${MONO}; text-transform: uppercase; letter-spacing: .04em; background: transparent; border: 1px solid #05d9e8; color: #e8f7ff; }
${PRIMARY} { background: #05d9e8; color: #0b0b12; border-color: #05d9e8; box-shadow: 3px 3px 0 #ff2a6d; }
:where(&) .chip.on { background: #ff2a6d; color: #0b0b12; border-color: #ff2a6d; }
${FIELDS} { font-family: ${MONO}; background: #0f0f18; border-color: #5f7f8f; color: #e8f7ff; }
${H1} { font-family: ${MONO}; text-transform: uppercase; letter-spacing: .02em; text-shadow: -2px 0 #ff2a6d, 2px 0 #05d9e8; animation: dk-glitch 5s steps(1) infinite; }
@keyframes dk-glitch { 0%, 90%, 100% { transform: none; clip-path: none; } 92% { transform: translate(-2px,1px); clip-path: inset(12% 0 55% 0); } 94% { transform: translate(2px,-1px); clip-path: inset(60% 0 8% 0); } 96% { transform: translate(-1px,0); clip-path: none; } }
@media (prefers-reduced-motion: reduce) { :where(&) .page-head h1, :where(&) .qhead h1 { animation: none; } }
html.lite:where(&) .page-head h1, html.lite:where(&) .qhead h1 { animation: none; }
${FAB} { border-radius: 4px; background: #05d9e8; color: #0b0b12; box-shadow: 4px 4px 0 #ff2a6d; }
&.lite .card, &.lite .tile, &.lite .modal { box-shadow: 3px 0 0 rgba(255,42,109,.55), -3px 0 0 rgba(5,217,232,.35) !important; }`,
  },
  {
    id: 'anti',
    t: { bg: '#f2f2ee', surface: '#ffffff', surface2: '#f7f7f2', surface3: '#eaeae2', border: '#111111', borderStrong: '#111111', text: '#111111', text2: '#2a2a2a', muted: '#474747', field: '#111111', good: '#006b2d', bad: '#b4001b', warn: '#834e00', brand: '#0047ff', onBrand: '#ffe600', brandFg: '#0037c7', accent: '#ff00d4', radius: '0px', radiusSm: '0px', font: '"Times New Roman", Times, "Noto Serif Devanagari", serif' },
    css: `
:where(&) .topbar { background: #ffe600; border-bottom: 4px solid #111; -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .topbar .title { color: #111; }
${darkTabbar('#111', '#ffe600', '#ff00d4')}
${SURFACES} { border: 3px solid #111; box-shadow: none; }
:where(&) .card:nth-of-type(odd) { transform: rotate(-.35deg); }
:where(&) .card:nth-of-type(even) { transform: rotate(.3deg); border-style: dashed; }
${BUTTON} { font-family: Arial, Helvetica, sans-serif; background: linear-gradient(#f6f6f6,#d8d8d8); border: 2px outset #bbb; border-radius: 0; color: #111; }
${PRIMARY} { background: #0047ff; color: #ffe600; border: 2px outset #3a74ff; font-family: Impact, "Arial Black", sans-serif; letter-spacing: .03em; }
:where(&) .chip.on { background: #ff00d4; color: #111; border: 2px solid #111; }
${H1} { font-family: Impact, "Arial Black", sans-serif; text-transform: uppercase; font-weight: 400; letter-spacing: .02em; display: inline; background: #ffe600; padding: 0 .12em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
:where(&) .main a:not(.btn):not(.qtool):not(.notecard):not(.pastelink) { text-decoration: underline wavy #ff00d4; }
${FAB} { border-radius: 0; background: #ff00d4; color: #111; transform: rotate(8deg); }`,
  },
  {
    id: 'inflated',
    t: { bg: '#efe4ff', surface: '#ffffff', surface2: '#f7f0ff', surface3: '#ece0ff', border: 'rgba(80,50,150,.12)', borderStrong: 'rgba(80,50,150,.24)', text: '#2a1f4a', text2: '#45396a', muted: '#5c5180', field: '#8c80b3', good: '#1a6646', bad: '#a62449', warn: '#7c4a00', brand: '#6a48f0', onBrand: '#ffffff', brandFg: '#5536d6', accent: '#ff8fb8', radius: '32px', radiusSm: '22px' },
    css: `
:where(&) body { background: radial-gradient(circle at 15% 15%, #ffd6e7 0, transparent 40%), radial-gradient(circle at 85% 20%, #d6f0ff 0, transparent 38%), radial-gradient(circle at 50% 100%, #ffe9b8 0, transparent 45%), var(--bg); background-attachment: fixed; }
:where(&) .tabbar, :where(&) .topbar { -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .tabbar { background: #fff; border: 0; box-shadow: inset 0 -6px 12px rgba(90,60,170,.1), 0 14px 24px -12px rgba(90,60,170,.45); }
${SURFACES} { border: 0; box-shadow: inset 0 -10px 18px rgba(90,60,170,.1), inset 0 10px 16px rgba(255,255,255,.9), 0 18px 30px -16px rgba(90,60,170,.45); }
${cells(['#ffc2d9', '#2a1f4a'], ['#d9cbff', '#2a1f4a'], ['#ffe39a', '#2a1f4a'], 'border-radius: 28px; box-shadow: inset 0 -8px 14px rgba(0,0,0,.08), inset 0 8px 12px rgba(255,255,255,.7), 0 12px 20px -12px rgba(90,60,170,.5);')}
${BUTTON} { border: 0; border-radius: 999px; background: linear-gradient(180deg,#ffffff,#efe6ff); box-shadow: inset 0 -4px 8px rgba(90,60,170,.15), inset 0 4px 6px #fff, 0 8px 14px -8px rgba(90,60,170,.5); }
${PRIMARY} { background: radial-gradient(120% 140% at 30% 20%, #7d5fff, #6340ec 50%, #4a2fc9); color: #fff; box-shadow: inset 0 -6px 10px rgba(40,10,120,.35), inset 0 6px 8px rgba(255,255,255,.45), 0 10px 18px -8px rgba(91,62,224,.6); }
:where(&) .chip.on { background: radial-gradient(120% 140% at 30% 20%, #ffc2d9, #ff8fb8); color: #2a1f4a; border-color: transparent; }
${FIELDS} { border: 0; border-radius: 20px; background: #f7f0ff; box-shadow: inset 0 3px 6px rgba(90,60,170,.15); }
${H1} { font-weight: 800; text-shadow: 0 3px 0 #ffd36e, 0 6px 10px rgba(90,60,170,.25); }
${FAB} { background: radial-gradient(circle at 35% 30%, #ffffff 0 8%, #ff8fb8 32%, #e0547f 100%); color: #2a1f4a; box-shadow: inset 0 -6px 10px rgba(120,20,60,.3), 0 10px 18px -6px rgba(224,84,127,.6); }`,
  },
  {
    id: 'iso',
    t: { bg: '#eef3fb', surface: '#ffffff', surface2: '#f3f7fd', surface3: '#e3ebf7', border: 'rgba(45,108,223,.18)', borderStrong: 'rgba(45,108,223,.35)', text: '#13213b', text2: '#33476b', muted: '#4d5f80', field: '#7488ad', good: '#0c6943', bad: '#a42c28', warn: '#834e00', brand: '#2d6cdf', onBrand: '#ffffff', brandFg: '#1f55b8', accent: '#ffb547', radius: '10px', radiusSm: '8px' },
    css: `
:where(&) body { background: repeating-linear-gradient(30deg, rgba(45,108,223,.08) 0 1px, transparent 1px 28px), repeating-linear-gradient(150deg, rgba(45,108,223,.08) 0 1px, transparent 1px 28px), var(--bg); }
:where(&) .topbar, :where(&) .tabbar { -webkit-backdrop-filter: none; backdrop-filter: none; background: #fff; }
${SURFACES} { border: 1.5px solid rgba(19,33,59,.18); box-shadow: 1px 1px 0 #b8c7e0, 2px 2px 0 #b8c7e0, 3px 3px 0 #b8c7e0, 4px 4px 0 #a6b8d8, 5px 5px 0 #a6b8d8, 6px 6px 0 #a6b8d8, 10px 14px 18px -6px rgba(19,33,59,.25); }
${cells(['#ffffff', '#13213b'], ['#dfe9fb', '#13213b'], ['#c3d5f5', '#13213b'], 'border: 1.5px solid rgba(19,33,59,.18) !important; box-shadow: 1px 1px 0 #a6b8d8, 2px 2px 0 #a6b8d8, 3px 3px 0 #a6b8d8, 4px 4px 0 #94a8cc;')}
${BUTTON} { border: 1.5px solid rgba(19,33,59,.25); box-shadow: 1px 1px 0 #a6b8d8, 2px 2px 0 #a6b8d8, 3px 3px 0 #a6b8d8; }
:where(&) button:active, :where(&) .btn:active { transform: translate(3px,3px); box-shadow: none; }
${PRIMARY} { background: #2d6cdf; color: #fff; border-color: #1d4a9e; box-shadow: 1px 1px 0 #1d4a9e, 2px 2px 0 #1d4a9e, 3px 3px 0 #1d4a9e, 4px 4px 0 #163a7d; }
:where(&) .chip.on { background: #ffb547; color: #13213b; border-color: #c98a1f; box-shadow: 1px 1px 0 #c98a1f, 2px 2px 0 #c98a1f; }
${H1} { text-shadow: 1px 1px 0 #b8c7e0, 2px 2px 0 #b8c7e0, 3px 3px 0 #a6b8d8; }
${FAB} { border-radius: 14px; background: #2d6cdf; color: #fff; box-shadow: 2px 2px 0 #1d4a9e, 4px 4px 0 #1d4a9e, 6px 6px 0 #163a7d; }
&.lite .card, &.lite .tile, &.lite .modal { box-shadow: 3px 3px 0 #b8c7e0, 6px 6px 0 #a6b8d8 !important; }`,
  },
  {
    id: 'ukiyo',
    t: { bg: '#efe6d2', surface: '#f8f2e3', surface2: '#f2e9d6', surface3: '#e8dcc2', border: 'rgba(30,58,95,.2)', borderStrong: 'rgba(30,58,95,.38)', text: '#1b2535', text2: '#33425a', muted: '#4b5770', field: '#7d7c77', good: '#295c40', bad: '#982e1c', warn: '#7c4a00', brand: '#1e3a5f', onBrand: '#f8f2e3', brandFg: '#1e3a5f', accent: '#b8382a', radius: '6px', radiusSm: '4px' },
    css: `
:where(&) body { background: ${svg('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32"><g fill="none" stroke="#1e3a5f" stroke-opacity=".11" stroke-width="1.2"><circle cx="32" cy="32" r="30"/><circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="14"/><circle cx="32" cy="32" r="6"/><circle cx="0" cy="16" r="30"/><circle cx="0" cy="16" r="22"/><circle cx="64" cy="16" r="30"/><circle cx="64" cy="16" r="22"/></g></svg>')}, var(--bg); }
${darkBars('#1e3a5f', '#f3ead6', '#ffb4a3', 'border-bottom: 4px solid #b8382a;')}
${SURFACES} { border: 1px solid rgba(30,58,95,.35); box-shadow: 4px 4px 0 rgba(30,58,95,.12); }
${BUTTON} { border: 1px solid #1e3a5f; border-radius: 4px; background: #f8f2e3; }
${PRIMARY} { background: #b8382a; color: #fff8ec; border-color: #8e2a1f; }
:where(&) .chip.on { background: #1e3a5f; color: #f8f2e3; border-color: #1e3a5f; }
${H1} { font-family: var(--serif); color: #1e3a5f; }
:where(&) .page-head h1::after { content: ""; display: inline-block; width: .42em; height: .42em; margin-left: .35em; background: #b8382a; border-radius: 3px; transform: rotate(8deg); vertical-align: .15em; }
${FAB} { background: #b8382a; color: #fff8ec; box-shadow: 0 0 0 4px #f8f2e3, 0 0 0 6px #1e3a5f; }`,
  },
  {
    id: 'brutal',
    t: { bg: '#ffffff', surface: '#ffffff', surface2: '#f4f4f4', surface3: '#e8e8e8', border: '#000000', borderStrong: '#000000', text: '#000000', text2: '#1a1a1a', muted: '#333333', field: '#000000', good: '#006400', bad: '#ad0000', warn: '#834e00', brand: '#000000', onBrand: '#ffffff', brandFg: '#0000ee', accent: '#ffeb00', radius: '0px', radiusSm: '0px', font: MONO, serif: MONO },
    css: `
:where(&) .topbar { background: #fff; border-bottom: 3px solid #000; -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .tabbar { background: #fff; border: 2px solid #000; border-radius: 0; box-shadow: 4px 4px 0 #000; -webkit-backdrop-filter: none; backdrop-filter: none; }
:where(&) .tabbar a.active { background: #ffeb00; color: #000; }
${SURFACES} { border: 2px solid #000; border-radius: 0; box-shadow: 5px 5px 0 #000; }
${BUTTON} { border: 2px solid #000; border-radius: 0; background: #fff; color: #000; text-transform: uppercase; font-weight: 700; box-shadow: 3px 3px 0 #000; }
:where(&) button:active, :where(&) .btn:active { transform: translate(3px,3px); box-shadow: none; }
${PRIMARY} { background: #000; color: #fff; }
:where(&) .chip.on { background: #ffeb00; color: #000; border: 2px solid #000; }
${FIELDS} { border: 2px solid #000; border-radius: 0; }
:where(&) .main a:not(.btn):not(.qtool):not(.notecard):not(.pastelink) { text-decoration: underline; }
${H1} { text-transform: uppercase; letter-spacing: -.02em; }
${FAB} { border-radius: 0; background: #000; color: #fff; box-shadow: 4px 4px 0 #ffeb00; }
&.lite .card, &.lite .tile, &.lite .modal { box-shadow: 5px 5px 0 #000 !important; }`,
  },
  {
    id: 'bauhaus',
    t: { bg: '#f3efe6', surface: '#fbf9f4', surface2: '#f0ebe0', surface3: '#e5dfd2', border: 'rgba(17,17,17,.2)', borderStrong: '#111111', text: '#111111', text2: '#2b2b2b', muted: '#4a4a4a', field: '#555555', good: '#1b6134', bad: '#a01e18', warn: '#7c4a00', brand: '#1d4fa3', onBrand: '#ffffff', brandFg: '#1d4fa3', accent: '#e53d2f', radius: '0px', radiusSm: '0px' },
    css: `
:where(&) body { background: radial-gradient(circle at 94% 10%, #f6c026 0 64px, transparent 65px), linear-gradient(#e53d2f,#e53d2f) 0 100% / 84px 84px no-repeat, conic-gradient(from 135deg at 100% 100%, #1d4fa3 0 90deg, transparent 0) 100% 100% / 150px 150px no-repeat, var(--bg); background-attachment: fixed; }
:where(&) .topbar { background: var(--bg); border-bottom: 4px solid #111; -webkit-backdrop-filter: none; backdrop-filter: none; }
${darkTabbar('#111', '#f3efe6', '#f6c026')}
:where(&) .tabbar { border-radius: 0; }
${SURFACES} { border: 0; border-radius: 0; box-shadow: none; border-top: 6px solid #111; }
:where(&) .card:nth-of-type(3n+1) { border-top-color: #e53d2f; } :where(&) .card:nth-of-type(3n+2) { border-top-color: #1d4fa3; } :where(&) .card:nth-of-type(3n) { border-top-color: #f6c026; }
${cells(['#c93324', '#ffffff'], ['#f6c026', '#111111'], ['#1d4fa3', '#ffffff'], 'border-top: 0;')}
:where(&) .qcell:nth-child(1), :where(&) .daysum > div:nth-child(1) { border-radius: 0 0 0 44px; }
:where(&) .qcell:nth-child(3), :where(&) .daysum > div:nth-child(3) { border-radius: 44px 0 0 0; }
${BUTTON} { border-radius: 0; border: 2px solid #111; background: #fbf9f4; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; font-size: .85rem; }
${PRIMARY} { background: #1d4fa3; color: #fff; border-color: #111; }
:where(&) .chip.on { background: #f6c026; color: #111; border: 2px solid #111; }
${FIELDS} { border-radius: 0; border: 2px solid #555; }
${H1} { text-transform: uppercase; font-weight: 800; letter-spacing: -.01em; }
:where(&) .page-head h1::before { content: ""; display: inline-block; width: .5em; height: .5em; border-radius: 50%; background: #e53d2f; margin-right: .25em; vertical-align: .05em; }
${FAB} { background: #e53d2f; color: #fff; border: 3px solid #111; box-shadow: none; }`,
  },
  {
    id: 'midcentury',
    t: { bg: '#f4ead5', surface: '#fffaf0', surface2: '#f7efde', surface3: '#efe2c8', border: 'rgba(91,58,41,.18)', borderStrong: 'rgba(91,58,41,.35)', text: '#2b1d14', text2: '#4a3628', muted: '#6b5344', field: '#9c8471', good: '#276443', bad: '#9f331c', warn: '#7c4a00', brand: '#2e7d7a', onBrand: '#ffffff', brandFg: '#22625f', accent: '#d9a43b', radius: '16px', radiusSm: '12px' },
    css: `
:where(&) body { background: ${svg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><g stroke="#d9a43b" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"><path d="M50 30v24M38 42h24M41 33l18 18M59 33L41 51"/></g><g stroke="#2e7d7a" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"><path d="M150 130v20M140 140h20M143 133l14 14M157 133l-14 14"/></g><path d="M120 50c20-10 40 0 50 20-15-8-30-8-50-20z" fill="#c8562d" fill-opacity=".18"/><circle cx="40" cy="150" r="10" fill="none" stroke="#5b3a29" stroke-opacity=".18" stroke-width="2"/></svg>')}, var(--bg); }
${darkBars('#5b3a29', '#f4ead5', '#ffd27a', 'box-shadow: 0 3px 0 #d9a43b, 0 6px 0 #2e7d7a, 0 9px 0 #c8562d;')}
${SURFACES} { border: 0; box-shadow: 0 2px 0 rgba(91,58,41,.12), 0 14px 24px -16px rgba(91,58,41,.45); }
${cells(['#2e7d7a', '#ffffff'], ['#d9a43b', '#2b1d14'], ['#b04722', '#ffffff'], 'border-radius: 40px 10px 40px 10px;')}
${BUTTON} { border-radius: 999px; border: 2px solid #5b3a29; background: #fffaf0; }
${PRIMARY} { background: #2e7d7a; color: #fff; border-color: #22625f; }
:where(&) .chip.on { background: #d9a43b; color: #2b1d14; border-color: #5b3a29; }
${H1} { font-family: var(--serif); color: #5b3a29; }
:where(&) .page-head h1::before { content: "\\2726"; color: #d9a43b; margin-right: .25em; font-size: .7em; vertical-align: .15em; }
${FAB} { background: #d9a43b; color: #2b1d14; box-shadow: 0 0 0 4px #fffaf0, 0 0 0 7px #2e7d7a; }`,
  },
  {
    // the landing page's look (public/css/landing.css) for the app: oat paper, ledger ink, one brick red, gold focus.
    // Follows Light/Dark: `dark` is the landing's night colours.
    id: 'landing',
    t: { bg: '#f1ebdd', surface: '#fbf8f0', surface2: '#f5f0e4', surface3: '#e9e1cf', border: '#d9d0ba', borderStrong: 'rgba(28,26,43,.42)', text: '#1c1a2b', text2: '#4f4b63', muted: '#5f5a72', field: '#8c8473', good: '#286346', bad: '#9c3329', warn: '#7c4a00', brand: '#1c1a2b', onBrand: '#f1ebdd', brandFg: '#a9372d', accent: '#ebb74a', radius: '12px', radiusSm: '10px', ring: '0 0 0 4px rgba(235,183,74,.5)',
      '--lp-line': '#d9d0ba', '--slip-dot': '#cdc4ae', '--lp-brick': '#a9372d', '--lp-gold': '#ebb74a', '--lp-nav': 'rgba(241,235,221,.92)', '--lp-bar': '#1c1a2b', '--lp-bar-fg': 'rgba(241,235,221,.8)', '--lp-bar-on': '#ebb74a', '--lp-fab': '#a9372d', '--lp-lift': '0 1px 0 rgba(28,26,43,.05), 0 22px 38px -28px rgba(28,26,43,.42)' },
    dark: { bg: '#15121f', surface: '#1e1a2b', surface2: '#252034', surface3: '#2d2840', border: 'rgba(241,235,221,.14)', borderStrong: 'rgba(241,235,221,.4)', text: '#f1ebdd', text2: '#d6cfbf', muted: '#b3ab9c', field: '#857d70', good: '#74c99f', bad: '#ff9a8c', warn: '#ebb74a', brand: '#f1ebdd', onBrand: '#15121f', brandFg: '#ebb74a',
      '--lp-line': 'rgba(241,235,221,.16)', '--slip-dot': 'rgba(241,235,221,.3)', '--lp-brick': '#ff9a8c', '--lp-nav': 'rgba(21,18,31,.9)', '--lp-bar': '#2d2840', '--lp-bar-fg': 'rgba(241,235,221,.78)', '--lp-fab': '#b8433a', '--lp-lift': '0 22px 38px -26px rgba(0,0,0,.85)' },
    css: `
/* top bar: the landing's paper nav; side menu on wide screens the same paper */
:where(&) .topbar { background: var(--lp-nav); border-bottom: 1px solid var(--lp-line); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
:where(&) .topbar .title { font-family: var(--serif); font-weight: 400; font-size: 1.15rem; letter-spacing: -.01em; }
:where(&) .side { background: var(--bg); border-right: 1px solid var(--lp-line); }
:where(&) .nav a.active { background: var(--text); color: var(--bg); }
/* tab bar: the landing's dark running-total bar, with a brick + button */
:where(&) .tabbar { background: var(--lp-bar); border: 0; border-radius: 14px; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 14px 30px -14px rgba(28,26,43,.6); }
&.lite .tabbar { background: var(--lp-bar) !important; }
:where(&) .tabbar a, :where(&) .tabbar button:not(.fab) { color: var(--lp-bar-fg); }
:where(&) .tabbar a.active { color: var(--lp-bar-on); }
${FAB} { background: var(--lp-fab); color: #fbf8f0; box-shadow: 0 0 0 5px var(--bg), 0 12px 22px -8px rgba(169,55,45,.55); }
/* big quiet serif headings, like the landing */
${H1} { font-weight: 400; letter-spacing: -.025em; line-height: 1; font-size: clamp(2.3rem, 1.6rem + 2.6vw, 3.1rem); }
:where(&) h2 { font-family: var(--serif); font-weight: 400; font-size: 1.22rem; letter-spacing: -.005em; }
/* paper cards with the landing's long soft shadow */
:where(&) .card, :where(&) .tile, :where(&) .cpanel, :where(&) .notecard, :where(&) .qtool, :where(&) .ctile { background: var(--surface); border: 1px solid var(--lp-line); border-radius: 10px; box-shadow: var(--lp-lift); }
:where(&) .notecard { border-style: dashed; box-shadow: none; }
/* summaries: one paper slip split by dashed rules, totals in the serif */
:where(&) .qsum, :where(&) .daysum { background: var(--surface); border: 1px solid var(--lp-line); border-radius: 10px; gap: 0; box-shadow: var(--lp-lift); }
:where(&) .qcell { background: transparent; }
:where(&) .qcell + .qcell, :where(&) .daysum > div + div { border-left: 1.5px dashed var(--lp-line); }
:where(&) .qcell .v, :where(&) .daysum .v { font-family: var(--serif); font-weight: 700; font-size: 1.4rem; letter-spacing: -.01em; font-variant-numeric: tabular-nums lining-nums; }
/* the khata strip: torn receipt edge, like the slip on the landing */
:where(&) .strip { border: 0; border-radius: 4px 4px 0 0; box-shadow: none; padding-bottom: 32px; -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 14px 100%; mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 14px 100%; }
/* buttons: ink outline; the main action is solid ink */
${BUTTON} { border-width: 1.5px; border-radius: 10px; background: transparent; box-shadow: none; font-weight: 620; }
${PRIMARY} { background: var(--brand); color: var(--on-brand); border-color: transparent; box-shadow: none; }
:where(&) .qtype { background: var(--surface); border: 1px solid var(--lp-line); }
:where(&) .qtype.on { background: var(--surface); border-color: var(--text); box-shadow: inset 0 0 0 1px var(--text); }
:where(&) .chip.on { background: var(--text); color: var(--bg); box-shadow: none; }
:where(&) .seg { background: transparent; box-shadow: inset 0 0 0 1.5px var(--lp-line); border-radius: 10px; padding: 0; gap: 0; overflow: hidden; }
:where(&) .seg button { border-radius: 0; min-height: 40px; }
:where(&) .seg button.on { background: var(--text); color: var(--bg); box-shadow: none; }
/* fields: writing paper with a brick caret and a gold focus ring; notes are written in the serif */
${FIELDS} { background: var(--surface); border-radius: 8px; caret-color: var(--lp-brick); }
:where(&) input:focus, :where(&) select:focus, :where(&) textarea:focus { border-color: var(--lp-gold); }
:where(&) textarea { font-family: var(--serif); font-size: 1.12rem; line-height: 1.5; }
:where(&) .dump-ta { font-family: var(--serif); font-size: 1.15rem; font-weight: 400; }
:where(&) .bigamt, :where(&) .amtbox .rs { font-family: var(--serif); font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums lining-nums; }
:where(&) .li .amt { font-family: var(--serif); font-weight: 700; letter-spacing: 0; font-variant-numeric: tabular-nums lining-nums; }
:where(&) .li .amt .d { font-family: var(--font); font-weight: 500; }
:where(&) .modal { border-color: var(--lp-line); }
& .toast:not(.err) { background: var(--lp-bar); color: #f1ebdd; border-radius: 12px; }
/* sign in: the landing's night finale on top, a sheet of paper below */
:where(&) .auth-hero { background: #15121f; color: #f1ebdd; }
:where(&) .auth-hero .mesh { display: none; }
:where(&) .auth-hero h1 { font-weight: 400; letter-spacing: -.02em; color: #f1ebdd; }
:where(&) .auth-hero p { color: rgba(241,235,221,.78); opacity: 1; }
:where(&) .auth-hero li .ico { background: rgba(235,183,74,.18); color: #ebb74a; }
:where(&) .auth-form { background: var(--bg); }
:where(&) .auth-form h2 { font-weight: 400; letter-spacing: -.02em; }
/* amounts in notes and lists read as numbers, not as warnings (brick is kept for accents and links) */
:where(&) .nl { color: var(--text-2); }`,
  },
  {
    // a bit of every style: each part of the screen borrows from a different one
    id: 'collage',
    t: { bg: '#fff6e9', surface: '#ffffff', surface2: '#fff1db', surface3: '#ffe3b8', border: 'rgba(17,17,17,.2)', borderStrong: '#111111', text: '#141414', text2: '#2e2a2a', muted: '#474747', field: '#555555', good: '#0a6447', bad: '#a81f33', warn: '#834e00', brand: '#1f4aa8', onBrand: '#ffffff', brandFg: '#1f4aa8', accent: '#ff6fae', radius: '18px', radiusSm: '12px' },
    css: `
/* body: Memphis confetti over a Vaporwave grid */
:where(&) body { background: ${svg('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><path d="M20 40q10-14 20 0t20 0 20 0" fill="none" stroke="#00b3a7" stroke-width="4" stroke-linecap="round" opacity=".4"/><path d="M150 30l18 30h-36z" fill="#ffd23f" opacity=".5"/><circle cx="170" cy="150" r="12" fill="none" stroke="#ff6fae" stroke-width="4" opacity=".45"/></svg>')}, repeating-linear-gradient(90deg, rgba(185,103,255,.14) 0 1px, transparent 1px 48px) bottom / 100% 30% no-repeat, repeating-linear-gradient(0deg, rgba(185,103,255,.14) 0 1px, transparent 1px 24px) bottom / 100% 30% no-repeat, var(--bg); background-attachment: fixed; }
/* bars: Liquid chrome */
:where(&) .topbar, :where(&) .tabbar { background: linear-gradient(180deg,#fdfdfe,#c9ced6 50%,#eef0f3); border-color: #9aa2ad; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: inset 0 1px 0 #fff, 0 6px 16px -8px rgba(20,24,30,.5); }
/* side menu: De Stijl */
:where(&) .side { border-right: 6px solid #111; box-shadow: inset 0 10px 0 #d42a20; }
/* page titles: Art Nouveau serif with a Glitch split */
:where(&) .page-head h1, :where(&) .qhead h1 { font-family: var(--serif); text-shadow: -2px 0 rgba(255,42,109,.7), 2px 0 rgba(5,217,232,.7); }
/* summary cells: Bauhaus blocks with De Stijl lines */
${cells(['#c93324', '#ffffff'], ['#f6c026', '#111111'], ['#1d4fa3', '#ffffff'], 'border: 4px solid #111 !important;')}
:where(&) .qcell:nth-child(1), :where(&) .daysum > div:nth-child(1) { border-radius: 0 0 0 40px; }
:where(&) .qcell:nth-child(3), :where(&) .daysum > div:nth-child(3) { border-radius: 40px 0 0 0; }
/* cards: Paper cutout */
:where(&) .card { border: 0; box-shadow: 0 3px 0 #f1cf9f, 0 7px 0 #e8b47a, 0 14px 22px -8px rgba(110,60,20,.3); }
/* the receipt strip: Steampunk parchment and brass */
:where(&) .strip { --slip: #f3e7c9; --slip-ink: #2a1c10; --slip-muted: #5e4a30; --slip-in: #2f5f2b; background: #f3e7c9; color: #2a1c10; border: 3px double #a5802e; box-shadow: inset 0 0 22px rgba(120,80,30,.16), 0 3px 0 #8a6a2a; }
/* report tiles: Memphis */
:where(&) .tile { border: 2.5px solid #111; box-shadow: 6px 6px 0 #111; }
/* quick tools: Isometric blocks */
:where(&) .qtool { border: 1.5px solid rgba(19,33,59,.2); box-shadow: 1px 1px 0 #b8c7e0, 2px 2px 0 #b8c7e0, 3px 3px 0 #a6b8d8, 4px 4px 0 #a6b8d8; }
/* sale/bought/expense picker: Neumorphism */
:where(&) .qtype { background: #fff6e9; border-color: transparent; box-shadow: 5px 5px 12px rgba(150,120,80,.35), -5px -5px 12px rgba(255,255,255,.9); }
:where(&) .qtype.on { box-shadow: inset 3px 3px 7px rgba(150,120,80,.35), inset -3px -3px 7px rgba(255,255,255,.9); }
/* notes: Grunge tape */
:where(&) .notecard { position: relative; border: 1px solid rgba(0,0,0,.15); box-shadow: 2px 3px 0 rgba(0,0,0,.25); }
:where(&) .notecard::before { content: ""; position: absolute; top: -8px; left: 20px; width: 70px; height: 16px; background: rgba(255,214,120,.65); transform: rotate(-4deg); pointer-events: none; }
/* list rows: Brutalism */
:where(&) .li + .li::before { height: 2px; background: #111; }
/* buttons: 3D inflated; main action: Liquid chrome */
:where(&) button, :where(&) .btn { border: 0; border-radius: 999px; background: linear-gradient(180deg,#ffffff,#f3eaff); box-shadow: inset 0 -4px 8px rgba(90,60,170,.15), inset 0 4px 6px #fff, 0 8px 14px -8px rgba(90,60,170,.5); }
:where(&) button.primary, :where(&) .btn.primary { background: linear-gradient(180deg,#4b525d,#1b1f26 50%,#2c323b); color: #f4f6f8; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 4px 10px -4px rgba(0,0,0,.5); }
/* chips: Memphis */
:where(&) .chip.on { background: #ff6fae; color: #141414; border: 2.5px solid #111; box-shadow: 3px 3px 0 #111; }
/* fields: Skeuomorphism */
:where(&) input, :where(&) select, :where(&) textarea { background: #fffdf8; border-color: #8a7a62; box-shadow: inset 0 2px 3px rgba(60,40,20,.16); }
/* sheets: Ukiyo-e washi with an indigo band */
:where(&) .modal { background: #f8f2e3; box-shadow: inset 0 6px 0 #1e3a5f, 0 -10px 40px rgba(0,0,0,.25); }
/* counter tiles: Mid-century colours */
:where(&) .ctile:nth-child(3n+1) { box-shadow: inset 0 4px 0 #2e7d7a; } :where(&) .ctile:nth-child(3n+2) { box-shadow: inset 0 4px 0 #d9a43b; } :where(&) .ctile:nth-child(3n) { box-shadow: inset 0 4px 0 #c8562d; }
/* chat: Vaporwave neon for replies */
:where(&) .bub.bub-bot { border: 1px solid #01cdfe; box-shadow: 0 0 0 1px rgba(255,113,206,.3); }
/* toasts: Anti-design */
:where(&) .toast { background: #ffe600; color: #111; border: 3px solid #111; border-radius: 0; transform: rotate(-1deg); font-family: Impact, "Arial Black", sans-serif; letter-spacing: .02em; }
/* the + button: Psychedelic */
:where(&) .tabbar .fab span.ring { background: conic-gradient(#ff9f1c,#ff5ea8,#b967ff,#7cf2c8,#ff9f1c); color: #2a0b45; }`,
  },
];

// ---- colour maths (WCAG 2.x) ----
const hex = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(h); if (!m) throw new Error(`not a #rrggbb colour: ${h}`); return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); };
const lum = (h) => { const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

// tint behind good / bad / warn badges (the contrast test checks badge text on this tint over every surface)
export const BADGE = 0.12;
export { mix };

export function rootSelector(id) { return `html.app-mode[data-style="${id}"]`; }

/** CSS for one style: colour tokens on the root, brand tokens on body (they beat the company colour set inline on <html>), then decorations. */
function decls(t, scheme) {
  const tokens = [
    `color-scheme: ${scheme}`,
    `--bg: ${t.bg}`, `--surface: ${t.surface}`, `--surface-2: ${t.surface2}`, `--surface-3: ${t.surface3}`,
    `--border: ${t.border}`, `--border-strong: ${t.borderStrong}`, `--text: ${t.text}`, `--text-2: ${t.text2}`, `--muted: ${t.muted}`, `--field: ${t.field}`,
    `--good: ${t.good}`, `--good-bg: ${rgba(t.good, BADGE)}`, `--bad: ${t.bad}`, `--bad-bg: ${rgba(t.bad, BADGE)}`, `--warn: ${t.warn || '#8a5200'}`, `--warn-bg: ${rgba(t.warn || '#8a5200', BADGE)}`,
    `--glass: ${rgba(t.surface, 0.9)}`, `--grid: ${rgba(t.text, 0.08)}`,
    `--series-1: ${t.brand}`, `--series-2: ${t.accent}`, `--series-3: ${t.good}`,
    `--radius: ${t.radius}`, `--radius-sm: ${t.radiusSm}`,
    `--slip: ${t.slip || t.surface}`, `--slip-ink: ${t.text}`, `--slip-muted: ${t.muted}`, `--slip-dot: ${t.field}`, `--slip-line: ${t.field}`, `--slip-in: ${t.good}`,
    ...(t.font ? [`--font: ${t.font}`] : []), ...(t.serif ? [`--serif: ${t.serif}`] : []),
    ...Object.entries(t).filter(([k]) => k.startsWith('--')).map(([k, v]) => `${k}: ${v}`), // a style's own extra variables
  ];
  const brand = [
    `--brand: ${t.brand}`, `--accent: ${t.accent}`, `--on-brand: ${t.onBrand}`,
    `--brand-06: ${rgba(t.brand, 0.06)}`, `--brand-10: ${rgba(t.brand, 0.1)}`, `--brand-16: ${rgba(t.brand, 0.16)}`, `--brand-25: ${rgba(t.brand, 0.25)}`, `--brand-40: ${rgba(t.brand, 0.4)}`,
    `--brand-fg: ${t.brandFg}`, `--brand-fg-l: ${t.brandFg}`, `--brand-fg-d: ${t.brandFg}`,
    `--brand-deep: ${mix(t.brand, '#000000', 0.35)}`, `--brand-light: ${mix(t.brand, '#ffffff', 0.3)}`, `--hero-a: ${t.brand}`, `--hero-b: ${mix(t.brand, '#000000', 0.35)}`,
    `--ring: ${t.ring || `0 0 0 4px ${rgba(t.brand, 0.28)}`}`,
  ];
  return { tokens: tokens.join('; '), brand: brand.join('; ') };
}

/** CSS for one style: colour tokens on the root, brand tokens on body (they beat the company colour set inline on <html>), then decorations.
 *  A style with `dark` follows the Light/Dark setting: those colours apply when the app is dark. */
export function themeCss({ id, t, dark, css }) {
  const S = rootSelector(id);
  const scheme = STYLES.find((x) => x.id === id)?.scheme === 'dark' ? 'dark' : 'light';
  const L = decls(t, scheme);
  let out = `/* ${id} */\n${S} { ${L.tokens}; }\n${S} body { ${L.brand}; background-color: var(--bg); color: var(--text); font-family: var(--font); }\n`;
  if (dark) {
    const D = decls({ ...t, ...dark }, 'dark');
    const block = (sel) => `${sel} { ${D.tokens}; }\n${sel} body { ${D.brand}; }`;
    out += `${block(`${S}[data-theme="dark"]`)}\n@media (prefers-color-scheme: dark) {\n${block(`${S}:not([data-theme="light"])`)}\n}\n`;
  }
  return out + css.replace(/&/g, S).trim() + '\n';
}

export function buildThemesCss() {
  return '/* Generated by scripts/themes.mjs - do not edit. Loaded by boot.js only for the styles in Settings > Style that live here. */\n'
    + THEMES.map(themeCss).join('\n');
}
