// The looks a person can pick in Settings > Style (saved per device as localStorage dk_style).
// scheme: 'any' follows the Light/Dark setting; 'light' / 'dark' means the style brings its own colours.
// css: where the style's CSS lives ('app' = always loaded in app.css, 'themes' = /css/themes.css, built by scripts/themes.mjs).
// swatch: four colours for the picker preview. Keep ids in sync with public/boot.js (test/styles.test.ts checks).
export const STYLES = [
  { id: 'clean', name: 'Clean', group: 'basic', scheme: 'any', css: 'app', swatch: ['#f3f4f8', '#ffffff', '#1c1a2b', '#2e6f4f'], blurb: 'Flat and calm' },
  { id: 'bento', name: 'Bento', group: 'basic', scheme: 'any', css: 'app', swatch: ['#ebe6da', '#2e6f4f', '#ebb74a', '#1c1a2b'], blurb: 'Colour tiles' },
  { id: 'skeuo', name: 'Skeuomorphism', group: 'art', scheme: 'light', css: 'themes', swatch: ['#e6ddc8', '#5a3b24', '#fbf7ee', '#3f7a3a'], blurb: 'Leather, linen, glossy buttons' },
  { id: 'soft', name: 'Neumorphism', group: 'art', scheme: 'any', css: 'app', swatch: ['#e6e9ef', '#e6e9ef', '#c9cfda', '#2e6f4f'], blurb: 'Raised, pillow-like' },
  { id: 'nouveau', name: 'Art Nouveau', group: 'art', scheme: 'light', css: 'themes', swatch: ['#f1e6cf', '#24402f', '#b8892d', '#fbf5e6'], blurb: 'Curves, gold, forest green' },
  { id: 'chrome', name: 'Liquid chrome', group: 'art', scheme: 'light', css: 'themes', swatch: ['#c9ced6', '#f7f8fa', '#1b1f26', '#8d96a3'], blurb: 'Polished, mirror-like metal' },
  { id: 'stijl', name: 'De Stijl', group: 'art', scheme: 'light', css: 'themes', swatch: ['#ffffff', '#d42a20', '#1f4aa8', '#f2c230'], blurb: 'Black lines, primary blocks' },
  { id: 'memphis', name: 'Memphis', group: 'art', scheme: 'light', css: 'themes', swatch: ['#fff6e9', '#ff6fae', '#00b3a7', '#ffd23f'], blurb: '80s squiggles, hard shadows' },
  { id: 'psych', name: 'Psychedelic', group: 'art', scheme: 'dark', css: 'themes', swatch: ['#2a0b45', '#ff5ea8', '#ff9f1c', '#7cf2c8'], blurb: 'Swirls of warm colour' },
  { id: 'vapor', name: 'Vaporwave', group: 'art', scheme: 'dark', css: 'themes', swatch: ['#1a103d', '#ff71ce', '#01cdfe', '#b967ff'], blurb: 'Neon sunset grid' },
  { id: 'steam', name: 'Steampunk', group: 'art', scheme: 'light', css: 'themes', swatch: ['#d9c59a', '#5a3a22', '#c9a043', '#7a4b1f'], blurb: 'Brass, wood, parchment' },
  { id: 'grunge', name: 'Grunge', group: 'art', scheme: 'dark', css: 'themes', swatch: ['#1f1e1c', '#ece6da', '#e0643f', '#2e2c29'], blurb: 'Rough paper and tape' },
  { id: 'cutout', name: 'Paper cutout', group: 'art', scheme: 'light', css: 'themes', swatch: ['#f6d9b4', '#fffaf2', '#e86a4a', '#5bb39a'], blurb: 'Layered paper' },
  { id: 'glitch', name: 'Glitch', group: 'art', scheme: 'dark', css: 'themes', swatch: ['#0b0b12', '#05d9e8', '#ff2a6d', '#e8f7ff'], blurb: 'Scanlines, split colour' },
  { id: 'anti', name: 'Anti-design', group: 'art', scheme: 'light', css: 'themes', swatch: ['#f2f2ee', '#ffe600', '#0047ff', '#111111'], blurb: 'Deliberately off, still usable' },
  { id: 'inflated', name: '3D inflated', group: 'art', scheme: 'light', css: 'themes', swatch: ['#efe4ff', '#ff8fb8', '#7c5cff', '#ffd36e'], blurb: 'Puffy, glossy balloons' },
  { id: 'iso', name: 'Isometric', group: 'art', scheme: 'light', css: 'themes', swatch: ['#eef3fb', '#ffffff', '#2d6cdf', '#b8c7e0'], blurb: 'Raised blocks on grid paper' },
  { id: 'ukiyo', name: 'Ukiyo-e', group: 'art', scheme: 'light', css: 'themes', swatch: ['#efe6d2', '#1e3a5f', '#b8382a', '#f7f0df'], blurb: 'Woodblock waves, indigo, vermilion' },
  { id: 'brutal', name: 'Brutalism', group: 'art', scheme: 'light', css: 'themes', swatch: ['#ffffff', '#000000', '#ffeb00', '#0000ee'], blurb: 'Raw, bold, monospace' },
  { id: 'bauhaus', name: 'Bauhaus', group: 'art', scheme: 'light', css: 'themes', swatch: ['#f3efe6', '#e53d2f', '#1d4fa3', '#f6c026'], blurb: 'Circles, squares, primaries' },
  { id: 'midcentury', name: 'Mid-century modern', group: 'art', scheme: 'light', css: 'themes', swatch: ['#f4ead5', '#2e7d7a', '#d9a43b', '#c8562d'], blurb: 'Teal, mustard, walnut' },
  { id: 'collage', name: 'Collage', group: 'mix', scheme: 'light', css: 'themes', swatch: ['#ff6fae', '#c9a043', '#1f4aa8', '#05d9e8'], blurb: 'A bit of every style at once' },
];
export const styleById = (id) => STYLES.find((s) => s.id === id) || STYLES[0];
export const currentStyle = () => styleById(document.documentElement.dataset.style || 'clean');

/** Loads /css/themes.css once (boot.js already adds it at start-up when an art style is saved). Resolves when ready, or after 3s. */
export function ensureThemesCss() {
  if (document.getElementById('themes-css')) return Promise.resolve();
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.id = 'themes-css'; l.href = '/css/themes.css';
  return new Promise((done) => { l.onload = l.onerror = () => done(); setTimeout(done, 3000); document.head.appendChild(l); });
}
/** Switches the look and saves it on this device. The caller re-applies the theme (theme.js) and re-renders. */
export async function setStyle(id) {
  const s = styleById(id);
  if (s.css === 'themes') await ensureThemesCss();
  try { if (s.id === 'clean') localStorage.removeItem('dk_style'); else localStorage.setItem('dk_style', s.id); } catch { /* storage blocked */ }
  if (s.id === 'clean') delete document.documentElement.dataset.style; else document.documentElement.dataset.style = s.id;
}
