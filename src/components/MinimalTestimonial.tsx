import { useState } from 'react';
import './MinimalTestimonial.css';

/**
 * 21st.dev "Minimal Testimonial" by jatin-yadav05
 * (https://21st.dev/@jatin-yadav05/components/minimal-testimonial). State and markup as
 * published; Tailwind translated into MinimalTestimonial.css with the site's tokens, next/image
 * replaced by a plain img (Astro sizes it upstream), and the sample data is a prop.
 */
export interface MinimalTestimonialItem {
  quote: string;
  name: string;
  role: string;
  image: string;
  /** Adaptation: the company's mark, shown with the role. */
  logo?: string;
}

export function TestimonialsMinimal({ testimonials }: { testimonials: MinimalTestimonialItem[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="mt">
      {/* Quote */}
      <div className="mt-quotes">
        {testimonials.map((t, i) => (
          <p key={i} className={`mt-quote${active === i ? ' is-active' : ''}`} aria-hidden={active !== i}>
            "{t.quote}"
          </p>
        ))}
      </div>

      {/* Author Row */}
      <div className="mt-row">
        {/* Avatars */}
        <div className="mt-avatars">
          {testimonials.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={active === i}
              aria-label={`${t.name}, ${t.role}`}
              className={`mt-avatar${active === i ? ' is-active' : ''}`}
            >
              <img src={t.image} alt="" width={40} height={40} />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-divider" />

        {/* Active Author Info */}
        <div className="mt-authors">
          {testimonials.map((t, i) => (
            <div key={i} className={`mt-author${active === i ? ' is-active' : ''}`} aria-hidden={active !== i}>
              <span className="mt-name">{t.name}</span>
              <span className="mt-role">
                {t.logo && <img className="mt-logo" src={t.logo} alt="" width={14} height={14} />}
                {t.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TestimonialsMinimal;
