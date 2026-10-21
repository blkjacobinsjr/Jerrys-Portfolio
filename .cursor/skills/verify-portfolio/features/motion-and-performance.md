# Motion and performance

Motion supports exploration while keeping the first visit fast and respecting pointer and motion preferences.

## Sub-features

- motion.decrypt: hover decoding only on fine hover pointers; readable text on touch.
- motion.gradient: the static work gradient stays still on and offscreen and under reduced motion. Animated drift was removed after failing the scroll budget.
- perf.initial: less than 180KiB initial encoded JavaScript and 500KiB encoded resources; no initial WebGL/model work.
- seo.domain: canonical, OG and sitemap use https://jerrydoughan.com.

## How to get to it (user POV)

Open a fresh page. Hover Jerry's name with a mouse, view Selected work, and switch the operating-system reduced-motion preference. Touch visitors read the same text without hover animation.

## Driving it with Playwright

Preconditions: production build, fresh browser context and no concurrent browser/performance job.

- Run `tests/perf/perf.spec.ts` for actual resource timing, WebGL allocation, frames, layout shifts, gradients and shadow presence.
- Run the hover-pointer test in `tests/e2e/revamp.spec.ts` on desktop and mobile.
- Run `npm run qa`; Lighthouse collects five reports per mobile and desktop profile and asserts 100 minimum in all categories on the median run. Preserve existing LCP, TBT and CLS limits.
- Read the real page metadata and /sitemap.xml; compare against literal expected URLs.

## Gotchas

A dev server is not a performance result. Model requests must be measured before any stop tap. Canvas 2D used for text measurement is not WebGL. Moving the pointer intentionally loads some existing dock effects, so capture the initial budget first. Keep performance work sequential; concurrency can distort measurements.
