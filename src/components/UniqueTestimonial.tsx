import { useState } from 'react';
import './UniqueTestimonial.css';

/**
 * 21st.dev "Unique Testimonial" by jatin-yadav05
 * (https://21st.dev/@jatin-yadav05/components/unique-testimonial). The component's state and
 * markup are kept as published; its Tailwind classes are translated into UniqueTestimonial.css
 * with the site's tokens (the site has no Tailwind), and the sample data is a prop.
 */
export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  avatar: string;
  /** Adaptation: the company's mark, shown with the role. */
  logo?: string;
}

const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function Testimonials({ testimonials }: { testimonials: TestimonialItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayedQuote, setDisplayedQuote] = useState(testimonials[0]!.quote);
  const [displayedRole, setDisplayedRole] = useState(testimonials[0]!.role);
  const [displayedLogo, setDisplayedLogo] = useState(testimonials[0]!.logo);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    if (index === activeIndex || isAnimating) return;
    setIsAnimating(true);

    setTimeout(() => {
      setDisplayedQuote(testimonials[index]!.quote);
      setDisplayedRole(testimonials[index]!.role);
      setDisplayedLogo(testimonials[index]!.logo);
      setActiveIndex(index);
      setTimeout(() => setIsAnimating(false), 400);
    }, 200);
  };

  return (
    <div className="ut">
      {/* Quote Container */}
      <div className="ut-quote-wrap">
        <span className="ut-mark ut-mark-open" aria-hidden="true">
          "
        </span>

        <p className={cn('ut-quote', isAnimating && 'is-animating')} aria-live="polite">
          {displayedQuote}
        </p>

        <span className="ut-mark ut-mark-close" aria-hidden="true">
          "
        </span>
      </div>

      <div className="ut-meta">
        {/* Role text */}
        <p className={cn('ut-role', isAnimating && 'is-animating')}>
          {displayedLogo && <img className="ut-logo" src={displayedLogo} alt="" width={14} height={14} />}
          {displayedRole}
        </p>

        <div className="ut-people">
          {testimonials.map((testimonial, index) => {
            const isActive = activeIndex === index;
            const isHovered = hoveredIndex === index && !isActive;
            const showName = isActive || isHovered;

            return (
              <button
                key={testimonial.author}
                type="button"
                onClick={() => handleSelect(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                aria-pressed={isActive}
                aria-label={`${testimonial.author}, ${testimonial.role}`}
                className={cn('ut-person', isActive && 'is-active', showName && 'is-named')}
              >
                {/* Avatar with smooth ring animation */}
                <div className="ut-avatar-wrap">
                  <img src={testimonial.avatar} alt="" width={32} height={32} className="ut-avatar" />
                </div>

                <div className="ut-name-grid">
                  <div className="ut-name-clip">
                    <span className="ut-name">{testimonial.author}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Testimonials;
