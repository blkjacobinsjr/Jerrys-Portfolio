# Recommendations

Visitors read six recommendations in one composition and a separate NASA honorary mention.

## Sub-features

- recs.order: Iñigo, Woundioun, Jerry Jiang, Gavin, Ian and Christoph.
- recs.composition: quote, round avatar, linked bold name, current role/detail and wins; verified company mark on the right.
- recs.honorary: Dan Goldin's exact public comment links to its LinkedIn source.

## How to get to it (user POV)

Scroll through About or use About in the dock. Swipe the carousel or use its previous/next buttons. The honorary mention follows it.

## Driving it with Playwright

Preconditions: owned preview, fresh context; check desktop and a 390px phone viewport.

- Inspect all six `.rec-card` figures. Each has one quote and figcaption, a round local portrait, a linked name, role, detail and wins. Names link to LinkedIn.
- Use the carousel controls and verify the next card can be reached.
- Inspect `.honorary-mention`; its comment is `Congrats Jerry Schmalz, good luck lots of support from here!` and links to the supplied LinkedIn post.
- Run the recommendation tests in `tests/e2e/revamp.spec.ts`, data tests in `tests/unit/revamp-content.test.ts` and page audits in `tests/e2e/a11y.spec.ts`.

## Gotchas

Ian Green's current employer is unverified; do not invent a company or logo. Dan's public quotation intentionally preserves Jerry's former name. Local portraits and logos must exist without an environment token. Offscreen carousel cards must not widen the document.
