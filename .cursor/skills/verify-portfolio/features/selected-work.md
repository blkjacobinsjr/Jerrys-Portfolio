# Selected work

Visitors open project cards and follow the real product links.

## Sub-features

- work.details: five branded cards open shared drawers.
- work.research: Scenaryo research CTA remains reachable at 390px.
- work.consulting: Leapfrog AI links to lfg-ai.com.

## How to get to it (user POV)

Scroll from the hero to Selected work, or use Work in the bottom dock. Tap a card, then scroll its drawer.

## Driving it with Playwright

Preconditions: owned preview, fresh context, viewport 390×844 for the phone CTA.

- Open Scenaryo with `getByRole('button', { name: /^Scenaryo:/ })`; the open dialog identifies Scenaryo.
- Scroll inside `dialog[open] .sheet` to expand it and reach `getByRole('link', { name: /Visit scenaryo\.app/ })`; its entire bounds must fit with at least 24px below it, and tapping opens https://scenaryo.app/research.
- Open `getByRole('button', { name: /^Leapfrog AI:/ })`; the drawer title and link identify Leapfrog AI and https://lfg-ai.com.
- Run the repo's `tests/e2e/revamp.spec.ts` or helper `verify.sh drive` and retain JSON, screenshot and ARIA proof.

## Gotchas

Mobile sheets have an initial detent and a full detent. Scroll to full before checking the last action. Scrollsheet uses a native dialog, so inspect only `dialog[open]`. External navigation is intercepted in repeatable tests; link destination is still asserted literally.
