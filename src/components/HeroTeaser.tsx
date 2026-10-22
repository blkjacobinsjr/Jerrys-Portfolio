import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import UniqueTestimonial from './UniqueTestimonial';
import './HeroTeaser.css';

/**
 * The recommendations teaser above the fold, in three ready-made styles so Jerry can pick one on
 * the live site: A = 21st.dev Unique Testimonial, B = 21st.dev Minimal Testimonial,
 * C = 21st.dev Animated Testimonials (radiumcoders). Only the selected one renders; A ships with
 * the page, the others load when chosen. The choice lives in ?t=a|b|c and localStorage.
 * Temporary: once Jerry picks, this switch and the other two components go.
 */
export interface TeaserQuote {
  quote: string;
  name: string;
  role: string;
  image: string;
  logo?: string;
}

type Variant = 'a' | 'b' | 'c';
const KEY = 'teaser-style';

type Props = { quotes: TeaserQuote[] };
const MinimalTestimonial = lazy(async () => {
  const { default: Minimal } = await import('./MinimalTestimonial');
  return { default: ({ quotes }: Props) => <Minimal testimonials={quotes} /> };
});

const VARIANTS: { id: Variant; label: string; title: string; available: boolean }[] = [
  { id: 'a', label: 'A', title: 'Unique testimonial', available: true },
  { id: 'b', label: 'B', title: 'Minimal testimonial', available: true },
  // The radiumcoders source is not in the repo yet (21st.dev retrieval limit); C turns on once it is.
  { id: 'c', label: 'C', title: 'Animated testimonials (coming)', available: false },
];

function Unique({ quotes }: Props) {
  return <UniqueTestimonial testimonials={quotes.map(({ quote, name, role, image, logo }) => ({ quote, author: name, role, avatar: image, logo }))} />;
}

const RENDER: Record<Variant, ComponentType<Props>> = { a: Unique, b: MinimalTestimonial, c: Unique };

export function readVariant(search: string, stored: string | null): Variant {
  const pick = new URLSearchParams(search).get('t') ?? stored;
  const found = VARIANTS.find((v) => v.id === pick && v.available);
  return found ? found.id : 'a';
}

export default function HeroTeaser({ quotes }: Props) {
  const [variant, setVariant] = useState<Variant>('a');
  useEffect(() => setVariant(readVariant(location.search, localStorage.getItem(KEY))), []);

  const choose = (next: Variant) => {
    setVariant(next);
    localStorage.setItem(KEY, next);
    const url = new URL(location.href);
    url.searchParams.set('t', next);
    history.replaceState(history.state, '', url);
  };

  const Selected = RENDER[variant];
  return (
    <div className="hero-teaser" data-variant={variant}>
      <Suspense fallback={<Unique quotes={quotes} />}>
        <Selected quotes={quotes} />
      </Suspense>
      <div className="teaser-switch" role="radiogroup" aria-label="Testimonial style">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={variant === v.id}
            aria-label={v.title}
            title={v.title}
            disabled={!v.available}
            tabIndex={variant === v.id ? 0 : -1}
            onClick={() => choose(v.id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              const open = VARIANTS.filter((x) => x.available);
              const at = open.findIndex((x) => x.id === variant);
              const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
              const next = open[(at + step + open.length) % open.length]!;
              choose(next.id);
              (event.currentTarget.parentElement?.querySelector(`[data-v="${next.id}"]`) as HTMLElement | null)?.focus();
            }}
            data-v={v.id}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
