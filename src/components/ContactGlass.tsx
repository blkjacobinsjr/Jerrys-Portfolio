import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { canUseGL } from '../lib/gl';
import { onFirstIntent } from '../lib/intent';
import { useMedia } from '../lib/useMedia';

const FluidGlass = lazy(() => import('./FluidGlass'));

/** Room around the heading so the lens can travel past its edges without clipping. */
const PAD = 96;

interface Layout {
  style: CSSProperties;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
}

/**
 * The heading's rendered lines, so the canvas text breaks where the DOM text does. Measured per character, because
 * DecryptedText splits the heading into one text node per glyph cell.
 */
function lines(el: HTMLElement): string {
  const range = document.createRange();
  // Skip DecryptedText's screen-reader copy (clipped) and its hidden width ghosts.
  const shown = (node: Node) => {
    const cs = getComputedStyle(node.parentElement as Element);
    return cs.visibility !== 'hidden' && cs.clip !== 'rect(0px, 0px, 0px, 0px)' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  };
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: shown });
  const rows: { top: number; text: string }[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width && /\s/.test(text[i])) {
        if (rows.length) rows[rows.length - 1].text += ' ';
        continue;
      }
      const last = rows[rows.length - 1];
      if (!last || rect.top - last.top > rect.height / 2) rows.push({ top: rect.top, text: text[i] });
      else last.text += text[i];
    }
  }
  return rows.map((row) => row.text.replace(/\s+/g, ' ').trim()).join('\n');
}

function measure(title: HTMLElement): Layout {
  const host = title.offsetParent as HTMLElement;
  const r = title.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  const cs = getComputedStyle(title);
  return {
    style: {
      position: 'absolute',
      left: r.left - h.left - PAD,
      top: r.top - h.top - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
      pointerEvents: 'none',
    },
    text: lines(title),
    fontSize: parseFloat(cs.fontSize),
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    color: cs.color,
  };
}

/**
 * React Bits FluidGlass over the footer heading. The island renders nothing until the GL gate
 * passes and the visitor shows intent (client:idle: an island that renders null has no box for client:visible to observe); reduced motion (live) unmounts it and the plain heading is back. The canvas
 * redraws the heading at its own size and line breaks; the DOM heading only turns transparent once the glass has had
 * a frame to paint, so there is never a moment without text, and it stays the accessible name.
 */
export default function ContactGlass() {
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const [armed, setArmed] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    if (reduced || !canUseGL()) return;
    return onFirstIntent(() => setArmed(true));
  }, [reduced]);

  const on = armed && !reduced;

  useEffect(() => {
    const title = document.getElementById('contact-title');
    if (!on || !title) return;
    const update = () => setLayout(measure(title));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(title);
    document.fonts?.ready.then(update);
    return () => {
      ro.disconnect();
      setLayout(null);
    };
  }, [on]);

  useEffect(() => {
    const title = document.getElementById('contact-title');
    if (!on || !layout || !title) return;
    // Two frames: the lazy chunk has mounted and drawn its first frame before the DOM text hides.
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => title.setAttribute('data-glass', ''))));
    return () => {
      cancelAnimationFrame(id);
      title.removeAttribute('data-glass');
    };
  }, [on, layout !== null]);

  if (!on || !layout) return null;
  return (
    <Suspense fallback={null}>
      <FluidGlass
        className="contact-glass"
        style={layout.style}
        text={layout.text}
        textColor={layout.color}
        fontFamily={layout.fontFamily}
        fontWeight={layout.fontWeight}
        fontSize={layout.fontSize}
        shape="lens"
        shapes={['lens', 'pill', 'blob', 'torus']}
        size={Math.min(170, layout.fontSize * 4)}
        maxDevicePixelRatio={1.5}
        shadow={0.25}
      />
    </Suspense>
  );
}
