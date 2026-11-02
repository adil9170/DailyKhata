// Runs before first paint (classic script, tiny): applies the saved theme and performance mode so there is no flash.
(function () {
  var d = document.documentElement, ls;
  try { ls = localStorage; } catch (e) { ls = null; }
  var t = ls && ls.getItem('dk_theme');
  if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  // Settings > Style. Keep in sync with public/js/styles.js (test/styles.test.ts checks): '' = CSS in app.css, follows Light/Dark;
  // 'any' / 'light' / 'dark' = CSS in /css/themes/<id>.css (loaded only for these); 'light' / 'dark' styles bring their own colours.
  var SS = { soft: '', bento: '', landing: 'any', skeuo: 'light', nouveau: 'light', chrome: 'light', stijl: 'light', memphis: 'light', psych: 'dark', vapor: 'dark', steam: 'light', grunge: 'dark', cutout: 'light', glitch: 'dark', anti: 'light', inflated: 'light', iso: 'light', ukiyo: 'light', brutal: 'light', bauhaus: 'light', midcentury: 'light', collage: 'light' };
  var st = ls && ls.getItem('dk_style');
  // No style saved yet: a device that has used the app before keeps Clean (its look so far); a new one starts on Paper & ink.
  // The choice is saved so it never flips later (e.g. after signing in on this device).
  if (ls && st === null) {
    var used = false;
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (/^dk_/.test(k) && !/^dk_(lang|perf|style|debug)$/.test(k)) { used = true; break; } }
    st = used ? 'clean' : 'landing';
    try { ls.setItem('dk_style', st); } catch (e) { /* storage full or blocked: decide again next time */ }
  }
  var sc = st && Object.prototype.hasOwnProperty.call(SS, st) ? SS[st] : null;
  if (sc !== null) d.setAttribute('data-style', st);
  // signed-in people (or anyone opening an app link) go straight to the app; everyone else sees the landing page
  var sess = null; try { sess = ls && JSON.parse(ls.getItem('dk_session') || 'null'); } catch (e) { sess = null; }
  if ((sess && sess.user) || /^#\/./.test(location.hash)) d.classList.add('app-mode');
  if (sc && d.classList.contains('app-mode')) {
    document.write('<link rel="stylesheet" id="theme-' + st + '" href="/css/themes/' + st + '.css">'); // st is a known id (SS); app.js loads it on sign-in from the landing page
    if (sc === 'light' || sc === 'dark') d.setAttribute('data-theme', sc); // art styles bring their own light or dark colours
  }
  // landing language (EN default; Hindi if chosen, or if the browser says hi): set <html lang> now and hold the page back until landing-i18n.js has painted it
  if (!d.classList.contains('app-mode')) {
    var lg = ls && ls.getItem('dk_lang');
    if (lg !== 'en' && lg !== 'hi') lg = /^hi/i.test(navigator.language || '') ? 'hi' : 'en';
    if (/^\/hi(\/|$)/.test(location.pathname)) lg = 'hi'; // the /hi/ page always opens in Hindi
    if (lg === 'hi') { d.lang = 'hi'; d.classList.add('lang-pending'); setTimeout(function () { d.classList.remove('lang-pending'); }, 2500); }
  }
  var perf = (ls && ls.getItem('dk_perf')) || 'auto';
  var mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  var saveData = navigator.connection && navigator.connection.saveData;
  var weak = mem <= 4 || cores <= 4 || saveData;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (perf === 'lite' || (perf === 'auto' && (weak || reduce))) d.classList.add('lite');
})();
