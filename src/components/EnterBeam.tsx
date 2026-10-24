import { BorderBeam } from 'border-beam';

/** POLISH (t174): libraries.dev Beam riding the "Enter with sound" border, only with ?polish=1. Mono and soft, so it reads
 *  as a quiet invitation on the night-sky gate rather than a rainbow. Still under reduced motion. */
export default function EnterBeam() {
  if (document.documentElement.dataset.polish !== 'on') return null;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <BorderBeam size="sm" colorVariant="mono" theme="dark" strength={0.45} borderRadius={4} active={!still} className="enter-beam-fx" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ width: '100%', height: '100%' }} />
    </BorderBeam>
  );
}
