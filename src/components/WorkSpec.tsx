import { useEffect } from 'react';
import DecryptedText from './DecryptedText';
import { cue } from '../lib/sound';

/** One project's facts as written in data/site.ts, nothing added. Empty fields are left out. */
export interface Spec {
  index: number;
  created: string;
  name: string;
  type: string;
  scope: string;
}

const STAGGER = 70;

/**
 * Spec-sheet overlay on a hovered selected-work card: monospace label / value lines that decrypt in one after the
 * other, each with a subtle tick cue (silent until sound has loaded, and when muted). Decorative: the card's link
 * already names the project, so the sheet is aria-hidden and never takes a pointer.
 */
export default function WorkSpec({ spec }: { spec: Spec }) {
  const lines: [string, string][] = [
    ['PRJCT', `/${String(spec.index + 1).padStart(2, '0')}`],
    ['CREATED AT', spec.created],
    ['NAME', spec.name],
    ['TYPE', spec.type],
    ['SCOPE', spec.scope],
  ].filter((line): line is [string, string] => Boolean(line[1]));

  useEffect(() => {
    const timers = lines.map((_, i) => setTimeout(() => cue('tick'), i * STAGGER));
    return () => timers.forEach(clearTimeout);
    // One run per card hovered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.name]);

  return (
    <dl className="work-spec" aria-hidden="true">
      {lines.map(([label, value], i) => (
        <div className="work-spec-line" key={label} style={{ animationDelay: `${i * STAGGER}ms` }}>
          <dt>{label}</dt>
          <dd>
            <DecryptedText text={value} animateOn="view" sequential speed={18} encryptedClassName="decrypting" />
          </dd>
        </div>
      ))}
    </dl>
  );
}
