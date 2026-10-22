import { useEffect, useState } from 'react';
import ModelLoader from './ModelLoader';
import { canUseGL } from '../lib/gl';
import { onFirstIntent } from '../lib/intent';
import type { LanyardProps } from './Lanyard';

/**
 * The buildspace lanyard from the path drawer, wearing the Leapfrog AI badge. The badge photo
 * is the page's first paint; the physics (three.js) only loads on the first pointer move,
 * wheel or key, and never without WebGL or with reduced motion, where the photo stays.
 */
export default function ConsultancyBadge({ image, alt, options }: { image: string; alt: string; options: LanyardProps }) {
  const [live, setLive] = useState(false);
  useEffect(() => (canUseGL() ? onFirstIntent(() => setLive(true)) : undefined), []);
  useEffect(() => {
    if (live) return undefined;
    // Touch has no pointer move before a tap: the first touch wakes it too.
    const wake = () => canUseGL() && setLive(true);
    addEventListener('touchstart', wake, { once: true, passive: true });
    return () => removeEventListener('touchstart', wake);
  }, [live]);

  return live ? (
    <ModelLoader kind="lanyard" image={image} alt={alt} options={options} />
  ) : (
    <div className="model-loader" data-model-state="static">
      <img className="model-loader__fallback" src={image} alt={alt} decoding="async" fetchPriority="high" />
    </div>
  );
}
