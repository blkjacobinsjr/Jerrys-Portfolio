import { canUseGL } from './gl';
import { onFirstIntent } from './intent';

/**
 * Liquid Object hover on the selected-work cards. Nothing loads on a first visit: only after the visitor's first
 * intent, on a fine hover pointer without reduced motion, and only when WebGL is allowed (`canUseGL()` probes a
 * context, so it must run inside the intent callback), does the React host get fetched and mounted.
 */
export function setupWorkLiquid(): void {
  if (!document.querySelector('.work-list')) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || reduce.matches) return;
  onFirstIntent(async () => {
    if (!canUseGL()) return;
    const [{ createElement }, { createRoot }, { default: Host }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('../components/WorkLiquidHost'),
    ]);
    const root = document.createElement('div');
    root.hidden = true;
    root.dataset.workLiquidHost = '';
    document.querySelector('.work-list')!.after(root);
    createRoot(root).render(createElement(Host));
  });
}
