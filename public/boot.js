// Runs before first paint (classic script, tiny): applies the saved theme and performance mode so there is no flash.
(function () {
  var d = document.documentElement, ls;
  try { ls = localStorage; } catch (e) { ls = null; }
  var t = ls && ls.getItem('dk_theme');
  if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  if (ls && ls.getItem('dk_style') === 'soft') d.setAttribute('data-style', 'soft');
  // signed-in people (or anyone opening an app link) go straight to the app; everyone else sees the landing page
  var sess = null; try { sess = ls && JSON.parse(ls.getItem('dk_session') || 'null'); } catch (e) { sess = null; }
  if ((sess && sess.user) || /^#\/./.test(location.hash)) d.classList.add('app-mode');
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
