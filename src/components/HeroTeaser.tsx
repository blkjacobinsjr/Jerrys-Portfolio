import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import MinimalTestimonial from './MinimalTestimonial';
import './HeroTeaser.css';

/**
 * The recommendations teaser above the fold, in two ready-made styles so Jerry can pick one on
 * the live site: A = 21st.dev Unique Testimonial, B = 21st.dev Minimal Testimonial. Only the
 * selected one renders; B is the default and ships with the page, A loads when chosen. The choice
 * lives in ?t=a|b and localStorage. Temporary: once Jerry picks, this switch and the other component go.
 */
export interface TeaserQuote {
  quote: string;
  name: string;
  role: string;
  image: string;
  logo?: string;
}

type Variant = 'a' | 'b';
const KEY = 'teaser-style';

type Props = { quotes: TeaserQuote[] };
const Unique = lazy(async () => {
  const { default: UniqueTestimonial } = await import('./UniqueTestimonial');
  return {
    default: ({ quotes }: Props) => (
      <UniqueTestimonial testimonials={quotes.map(({ quote, name, role, image, logo }) => ({ quote, author: name, role, avatar: image, logo }))} />
    ),
  };
});

const VARIANTS: { id: Variant; label: string; title: string }[] = [
  { id: 'a', label: 'A', title: 'Unique testimonial' },
  { id: 'b', label: 'B', title: 'Minimal testimonial' },
];

function Minimal({ quotes }: Props) {
  return <MinimalTestimonial testimonials={quotes} />;
}

const RENDER: Record<Variant, ComponentType<Props>> = { a: Unique, b: Minimal };

export function readVariant(search: string, stored: string | null): Variant {
  const pick = new URLSearchParams(search).get('t') ?? stored;
  const found = VARIANTS.find((v) => v.id === pick);
  return found ? found.id : 'b';
}

export default function HeroTeaser({ quotes }: Props) {
  const [variant, setVariant] = useState<Variant>('b');
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
      <Suspense fallback={<Minimal quotes={quotes} />}>
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
            tabIndex={variant === v.id ? 0 : -1}
            onClick={() => choose(v.id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              const at = VARIANTS.findIndex((x) => x.id === variant);
              const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
              const next = VARIANTS[(at + step + VARIANTS.length) % VARIANTS.length]!;
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
