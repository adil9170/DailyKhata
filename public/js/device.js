// Device adaptation. No user-agent guessing for layout: CSS uses real viewport size, pointer type and safe areas.
// This script only publishes those facts as attributes on <html> so the stylesheet can tune controls per device class:
//   data-size   xs <360 · s 360-389 (Redmi, small Androids) · m 390-429 (iPhone Pro, Galaxy S Ultra) · l 430-599 · tablet · desktop
//   data-os     ios | android | other        data-input  touch | mouse        data-standalone  true when installed as an app
// It also hides bottom bars while the on-screen keyboard is open and gives light haptic taps on Android.
const root = document.documentElement;

function osName() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
const sizeOf = (w) => (w < 360 ? 'xs' : w < 390 ? 's' : w < 430 ? 'm' : w < 600 ? 'l' : w < 1024 ? 'tablet' : 'desktop');

let frame = 0;
function measure() {
  frame = 0;
  const vv = window.visualViewport;
  const w = Math.round(vv ? Math.max(vv.width, 0) || innerWidth : innerWidth);
  root.dataset.size = sizeOf(Math.min(w, innerWidth));
  root.dataset.input = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
  root.dataset.orient = innerWidth > innerHeight ? 'landscape' : 'portrait';
  // Keyboard open = visual viewport much shorter than the layout viewport (phones only).
  const kb = !!vv && root.dataset.input === 'touch' && innerHeight - vv.height > 140;
  root.classList.toggle('kb', kb);
}
const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };

root.dataset.os = osName();
root.dataset.standalone = String(matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
measure();
addEventListener('resize', schedule, { passive: true });
addEventListener('orientationchange', schedule, { passive: true });
window.visualViewport?.addEventListener('resize', schedule, { passive: true });

// Light haptic tick on Android for primary actions (iOS Safari has no vibration API; CSS press-states cover it).
if (root.dataset.os === 'android' && 'vibrate' in navigator) {
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && e.target.closest?.('button.primary, .chip, .qtype, .fab, .modecard, .tabbar a')) navigator.vibrate(6);
  }, { passive: true });
}
