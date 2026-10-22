# Selected work

Visitors open project cards and follow the real product links.

## Sub-features

- work.details: five branded cards open shared drawers.
- work.research: Scenaryo research CTA remains reachable at 390px.
- work.consulting: Leapfrog AI links to lfg-ai.com.
- work.carousel: each work drawer lazily shows React Bits Flex Carousel with buttons, arrow keys,
  swipe and a live index. Reduced motion, data saver, unavailable WebGL and chunk failures keep images.

## How to get to it (user POV)

Scroll from the hero to Selected work, or use Work in the bottom dock. Tap a card, then scroll its drawer.

## Driving it with Playwright

Preconditions: owned preview, fresh context, viewport 390×844 for the phone CTA.

- Open Scenaryo with `getByRole('button', { name: /^Scenaryo:/ })`; the open dialog identifies Scenaryo.
- Scroll inside `dialog[open] .sheet` to expand it and reach `getByRole('link', { name: /Visit scenaryo\.app/ })`; its entire bounds must fit with at least 24px below it, and tapping opens https://scenaryo.app/research.
- Open `getByRole('button', { name: /^Leapfrog AI:/ })`; the drawer title and link identify Leapfrog AI and https://lfg-ai.com.
- Run the repo's `tests/e2e/revamp.spec.ts` or helper `verify.sh drive` and retain JSON, screenshot and ARIA proof.
- Run `tests/e2e/work-carousel.spec.ts` on desktop, mobile and safari. Check the reserved gallery box,
  cached reopen, context release on close and live reduced-motion changes, and vertical wheel/touch
  scrolling through the carousel into the drawer. Chromium uses real CDP touch gestures; WebKit swipe
  coverage uses synthetic pointer events, and its mobile vertical-scroll gesture is not verified there.

## Gotchas

Mobile sheets have an initial detent and a full detent. Scroll to full before checking the last action. Scrollsheet uses a native dialog, so inspect only `dialog[open]`. External navigation is intercepted in repeatable tests; link destination is still asserted literally.
