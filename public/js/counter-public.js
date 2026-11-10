// Public cash counter at /counter/: the same counter page, no sign-in, nothing sent to the server.
import './device.js';
import { counterPage } from './pages/counter.js';
import { applyLangAttr } from './i18n.js';
try { applyLangAttr?.(); } catch { /* optional */ }
counterPage(document.getElementById('main')).catch((e) => { document.getElementById('main').textContent = e.message; });
