// Runs before first paint (classic script, tiny): applies the saved theme and performance mode so there is no flash.
(function () {
  var d = document.documentElement, ls;
  try { ls = localStorage; } catch (e) { ls = null; }
  var t = ls && ls.getItem('dk_theme');
  if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  if (ls && ls.getItem('dk_style') === 'soft') d.setAttribute('data-style', 'soft');
  var perf = (ls && ls.getItem('dk_perf')) || 'auto';
  var mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  var saveData = navigator.connection && navigator.connection.saveData;
  var weak = mem <= 4 || cores <= 4 || saveData;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (perf === 'lite' || (perf === 'auto' && (weak || reduce))) d.classList.add('lite');
})();
