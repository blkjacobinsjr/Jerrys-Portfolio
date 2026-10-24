// E3 boot, bundled into Base's one module chunk (no extra critical request on phones, which matter for mobile LCP).
// The attribute is only ever set on a desktop with a fine pointer (Base.astro), so phones never load three.js.
// three.js, the screen texture and the two desk layers wait for the first intent (pointer, wheel, key, scroll),
// like every other WebGL effect on the page; until then the full-bleed v3 screen is all there is to see.
const root = document.documentElement;
const start = () => {
  const intents = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'scroll'] as const;
  const go = () => {
    intents.forEach((t) => removeEventListener(t, go));
    root.dataset.e3 = '';
    import('../scripts/hero-laptop').then((m) => m.heroLaptop());
  };
  if (scrollY > 0) go();
  else intents.forEach((t) => addEventListener(t, go, { passive: true }));
};
if (root.dataset.heroZoom === 'laptop') start();
else if (root.dataset.heroZoomOff && root.dataset.heroZoomOff !== 'query') {
  // Off at load (e.g. a narrow window): a one-time hero-zoom event, or a resize that now passes while the page is
  // still at the top (so the layout never jumps mid-read), turns it on. Phones never pass the pointer check.
  const check = window as unknown as { __heroZoom?: () => boolean };
  const later = () => {
    if (scrollY > 0 || !check.__heroZoom?.()) return;
    removeEventListener('resize', later);
    removeEventListener('hero-zoom', later);
    start();
  };
  addEventListener('resize', later, { passive: true });
  addEventListener('hero-zoom', later);
}
