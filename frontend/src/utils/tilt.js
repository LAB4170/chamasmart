// One delegated listener gives every raised card a gentle 3D tilt toward the mouse.
// Mouse only (touch has no hover), skipped when the person prefers reduced motion.
const SELECTOR = '.cs-chama, .cs-stat, .cs-loan, .cs-tilt, .cs-hero, .stat-card-lux, .member-card-lux';

export function initTilt() {
  if (typeof window === 'undefined') return;
  const mq = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  if (!mq.matches) return;
  let current = null;
  const reset = (el) => { if (!el) return; el.classList.remove('is-tilting'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target instanceof Element ? e.target.closest(SELECTOR) : null;
    if (el !== current) { reset(current); current = el; }
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const big = el.classList.contains('cs-hero') || r.width > 700;
    const k = big ? 0.35 : 1;
    el.classList.add('is-tilting');
    el.style.setProperty('--ry', `${((x - 0.5) * 9 * k).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - y) * 7 * k).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    if (big) el.style.setProperty('--lift', '0px');
  }, { passive: true });
  document.addEventListener('pointerleave', () => { reset(current); current = null; }, true);
  window.addEventListener('blur', () => { reset(current); current = null; });
}
