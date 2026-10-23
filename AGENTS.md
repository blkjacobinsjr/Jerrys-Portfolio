# Agent notes: Jerry's portfolio

Read this before changing the site. The QA gate is `npm run qa` (see `.cursor/skills/verify-portfolio`).
Never lower a threshold, skip a journey or delete an assertion to get green.

## Routing table

Find the owner of a change here first, then read its insight below before editing.

| Area (what you see) | Source | Lazy/gate | Tests |
| --- | --- | --- | --- |
| Hero: desk (mobile LCP), signature replay, recommendations teaser | `components/Hero.astro`, `Desk.tsx`, `Signature.astro`, `MinimalTestimonial.tsx`, `data/recommendations.ts` | desk AVIF preloaded in `pages/index.astro` | `e2e/signature.spec.ts`, `e2e/teaser-b.spec.ts` |
| Startup programs logos and tooltips (in the hero) | `StartupPrograms.astro` (used by `Hero.astro`) | none (static) | `e2e/site.spec.ts`, `e2e/a11y.spec.ts` |
| Selected work cards, logo loop, Liquid hover | `WorkSection.astro`, `LogoLoop.tsx`, `WorkCards.astro`, `WorkLiquidHost.tsx`, `WorkLiquid.tsx`, `lib/work-liquid.ts` | first intent, fine pointer, `canUseGL()` | `e2e/work-cards.spec.ts`, `e2e/work-liquid.spec.ts` |
| Project pages, gallery, lightbox, card transition | `pages/work/[slug].astro`, `WorkGallery.tsx`, `FlexCarousel.tsx`, `lib/lightbox.ts`, `styles/work-transition.css` | gallery 25% visible + GL gate; PhotoSwipe on first tap | `e2e/work-pages.spec.ts`, `e2e/work-carousel.spec.ts`, `e2e/deep-links.spec.ts` |
| Path strip, drawers, circular gallery | `Path.astro`, `PathSheet.tsx`, `Drawer.tsx`, `PathGallery.tsx`, `lib/path-gallery.ts`, `lib/overlay.ts` | `client:visible` + GL gate | `e2e/overlays.spec.ts`, `unit/path-gallery.test.ts`, `unit/overlay.test.ts` |
| 3D models (desk, buildspace badge, consultancy) | `ModelLoader.tsx`, `Lanyard.tsx` | first intent + GL gate | `e2e/model-lifecycle.spec.ts` |
| Footer: skyline, ghost cursor, keyring, FluidGlass heading, copy-email | `Contact.astro`, `FooterGhost.tsx`, `GhostCursor.tsx`, `Keyring.astro`, `ContactGlass.tsx` + `FluidGlass.tsx`, `ContactCTA.tsx` | ghost: `client:visible`, fine pointer; glass: idle island, pointer in the footer, then GL gate; live reduced motion | `e2e/footer-ghost.spec.ts`, `e2e/contact-glass.spec.ts` |
| Dock and liquid-glass nav | `Dock.tsx`, `Dock.css` | lens map on first intent, fine pointer | `e2e/site.spec.ts` |
| /contact letter (tear ticket, crumple) | `pages/contact.astro`, `Letter.tsx`, `TearTicket.tsx`, `PaperCrumple.tsx`, `lib/letter.ts` | crumple: first intent + GL gate | `e2e/pages.spec.ts` |
| /writing, /consultancy, RSS, sitemap | `layouts/Page.astro`, `pages/writing/*`, `pages/consultancy.astro`, `content/writing`, `pages/rss.xml.ts`, `pages/sitemap.xml.ts` | n/a | `e2e/pages.spec.ts`, `unit/pages.test.ts` |
| Cue sounds | `lib/sound.ts` (Cuelume) | after first gesture | `unit/sound.test.ts` |
| Smooth scroll, pins | `lib/scroll.ts` (Lenis), `lib/intent.ts` | idle | `e2e/overlays.spec.ts` |
| Content and data | `data/site.ts`, `data/recommendations.ts` | n/a | `unit/content.test.ts`, `unit/revamp-content.test.ts` |
| Link previews | `public/og.jpg`, `public/og.mp4`, `tools/og-video.mjs` | n/a | `unit/og-video.test.ts` |
| Performance budgets | `lighthouserc.json` (mobile), `lighthouserc.desktop.cjs` | n/a | `npm run test:lighthouse`, `tests/perf` |

Deploys: `main` on GitHub deploys to jerrydoughan.com (Vercel). Long jobs follow `/workspace/systems/loop-prevention.md`.

## Hard-won insights

### Overlays own their scrolling (Oct 2026)

**What broke:** the path and work drawers could not be scrolled with a mouse wheel or trackpad.
The bottom of long entries (Draper University, buildspace) was cut off on a 1024x640 laptop.

**Root cause:** Lenis (smooth page scroll, `src/lib/scroll.ts`) listens for `wheel` on the window
and calls `preventDefault()` on every event, including the ones that start inside a modal `<dialog>`.
The drawer panel was already a valid scroll container (`overflow-y: auto`, taller content than
viewport). Its wheel events were cancelled and Lenis scrolled the page behind the drawer instead.
Programmatic scrolling (`el.scrollTo`) and the old tests still passed, which is why it went unnoticed.
Only real wheel input reproduced it.

**The rule:**
- Every overlay (drawer, sheet, modal, menu) is built with `src/components/Drawer.tsx`. Selected work is not an
  overlay: each project has its own page (`pages/work/[slug].astro`). The one exception is the project
  gallery's lightbox (`src/lib/lightbox.ts`, PhotoSwipe, fetched on the first tap): it is a library
  `position: fixed` layer, so it follows the contract by hand (`data-overlay`, `lockScroll()`).
  Don't use `Sheet.Root`, `<dialog>` or `showModal()` anywhere else. Don't add another `position: fixed`
  layer that holds content. `tests/unit/overlay.test.ts` fails if you do.
- Drawer applies the contract in `src/lib/overlay.ts`:
  - The panel is marked `data-overlay` and is its own scroll port (`max-height: 100dvh`,
    `overflow-y: auto`, contained overscroll on desktop, shrinkable children).
  - While it is open, `lockScroll()` locks the page. It is ref-counted, pauses Lenis, and restores
    the exact scroll position on close.
  - scrollsheet's native modal `<dialog>` supplies the focus trap, Escape and safe-area padding.
- A page-level `wheel`, `touch` or `keydown` scroll handler (Lenis, the pinned path, anything new)
  must ignore events where `isInsideOverlay(event.target)` is true. Lenis does this through its
  `prevent` option.
- Test scrolling with real input: `page.mouse.wheel` or a CDP touch scroll gesture, never `scrollTo`.
  `tests/e2e/overlays.spec.ts` opens every drawer entry point at 1024x640 and 390x664. It scrolls
  each one to its last line by wheel or touch and checks that the page behind did not move.

### Scrollbar gutter and the scroll lock (Oct 2026)

**What broke:** closing the first path drawer on a 1024px laptop left the page 47px off.
**Root cause:** `scrollbar-gutter: stable` was set only on `html[data-scroll-locked]`. Headless
Chromium reports no scrollbar until overflow is hidden, so the gutter appeared only on lock, the page
narrowed by 15px and every 16/10 work card got shorter behind the drawer.
**The rule:** the gutter is reserved on `html` at all times; never add layout-affecting styles only
while locked.

### Flex Carousel on project pages (Oct 2026)

- Keep `FlexCarousel.tsx` and `.css` identical to the React Bits TS-CSS registry source. Page
  integration belongs in `WorkGallery`: lazy import after the open gallery is at least 25% visible,
  `canUseGL()` gating, and a live reduced-motion preference through `useMedia`.
- Set `captureWheel={false}` and override the library's `overscroll-behavior: contain` to `auto`.
  The non-scrolling carousel box must chain vertical input to the page.
- Reserve the same gallery height for the static strip and WebGL view. Use the existing Astro image
  candidates for textures, capped at 1200px, rather than original assets.
- The library has no imperative navigation API. Buttons dispatch its existing arrow-key events;
  dispatch `Home` on mount so cached textures cannot select the phone screenshot at the loop edge.
  Enabling reduced motion unmounts the component and releases its context.
- The gallery runs edge to edge; its slides keep one gutter from each screen edge (`padding-inline` =
  `scroll-padding-inline`, `scroll-snap-type: x mandatory`). `tests/e2e/work-pages.spec.ts` checks it at 390px.
- `tests/e2e/work-carousel.spec.ts` covers these contracts. A browser launch failure does not verify
  scrolling, swipe handling, context disposal or layout stability.

### Shadows and content-visibility (Oct 2026)

**What broke:** a hard vertical line ran down every selected-work card at about 45% of its width.
**Root cause:** `.work-shot` has `content-visibility: auto` (it keeps the phone image from loading
early). That implies paint containment, which clips everything its children paint at the box edge,
including the `drop-shadow` on the phone image inside it.
**The fix:** `.work-shot` is padded (content-box sizing, offsets cancelled) so the clip edge sits
beyond the shadow. Moving the filter onto `.work-shot` itself also removed the line, but it made the
browser re-rasterise the filter every frame of the phone-rise scroll animation (p95 frame 100ms+).
**The rule:** a child of a box with `content-visibility: auto`, `contain: paint` or `overflow: clip`
may only paint inside its padding box; give a shadowed child room with padding, and keep filters
on the element that animates rather than on a static ancestor. `tests/e2e/work-cards.spec.ts`
renders the band across that edge with and without containment and requires them to match.

### WebGL never starts on its own during load (Oct 2026)

**What broke:** /consultancy Lighthouse TBT went from ~0 to 152s when the lanyard physics started on `requestIdleCallback`.
**Root cause:** headless Chromium renders WebGL in software; every lanyard frame was a ~700ms long task, and the breeze
keeps the loop from ever resting.
**The rule:** load-time motion is CSS (transform/opacity on the poster: `badge-swing` in `consultancy.astro`); three.js,
FluidGlass and other WebGL start only on `onFirstIntent` (plus `touchstart` on phones). `tests/perf/perf.spec.ts` checks
the home page; the consultancy LH TBT gate catches it there.

### Link previews

- `public/og.jpg` is the share image (the keyring, with the locket photo pixelated). Keep it.
- `public/og.mp4` is the looping og:video reel that iMessage plays. After a redesign, regenerate it
  with `npm run build && npm run og:video` (`tools/og-video.mjs`); it is not part of the build.
  The script pixelates the baby photo in every frame and refuses to capture an unpixelated locket.
  `tests/unit/og-video.test.ts` keeps the reel silent, fast-start and within its 1.5 MB budget.

### Path drawers

- The rail card (`Path.astro`) reads: `when · where`, the model with nothing on top of it, then the
  mark and organisation, then the role. The mark is `StopLogo`, the same component as the drawer's.
- Order, for every stop (`src/components/PathSheet.tsx`): model, header (mark, organisation, role, one
  muted `when · where` line), story, notes, then the before-and-after wheel, then photos and link.
  The wheel closes the text; `tests/e2e/overlays.spec.ts` checks it sits below the notes and scrolls
  into reach at 1024x640 and 390x664.
- Organisation marks live in `src/assets/stops/logos/<stop id>.png`, set as `logo` on the stop in
  `src/data/site.ts`. `node tools/fetch-logos.mjs` refetches them: from logo.dev with `LOGO_DEV_TOKEN`
  set, otherwise from each organisation's own icon. Personal stops get no mark.

### Hero recommendations teaser (Oct 2026)

`Hero.astro` renders 21st.dev Minimal Testimonial (`components/MinimalTestimonial.tsx`) with three
verbatim fragments (`teaser` in `data/recommendations.ts`, which also carries each person's portrait
and company logo from the same records, never a copy). Jerry picked it over Unique Testimonial (A) and
radiumcoders Animated Testimonials (C, source behind 21st.dev sign-in) on the live site; the A · B
switch and A are gone. Its Tailwind classes are translated one for one into plain CSS with the site
tokens (no Tailwind here); the one deliberate change is half the published `mb-12` under the quote.
`tests/e2e/teaser-b.spec.ts` checks it at 390, 768, 1024 and 1440 in light and dark.

### Stacked crossfades and shrink-to-fit columns (Oct 2026)

**What broke:** teaser B's last quote line ran under the avatars, the quote wrapped in a 157px column
and "Jerry Jiang" broke onto two lines.
**Root cause:** the 21st.dev source stacks its quotes and bylines with `absolute inset-0` in a box with a
fixed `min-height`. Absolute children add no width or height. Inside a `justify-items: start` grid the
teaser shrank to the width of the avatar row, so the name column was 0px wide. The 2-line min-height
could not hold a 3-line quote either.
**The rule:** stack crossfading items in one grid cell (`display: grid` on the box, `grid-area: 1 / 1` on
each item), never `absolute inset-0`. The longest item then sizes the box at every width.
**Also:** overlapping avatar buttons must leave 24px unobscured (WCAG 2.5.8, Lighthouse `target-size`).
The scaled active avatar covers 2px more of its neighbour. At the published 8px overlap the middle
avatar keeps only 22px clear, so the overlap is 7px.

### Traced signature masks (Oct 2026)

The final frame adds the oval's top edge and the diagonal slash close together. Classify slash pixels by
distance from its fitted axis, then keep the remaining late oval pixels in stroke 2 and extend that
centreline through their centroids. Derive each mask width from the furthest final fill pixel to its
rasterized centreline; source brush thickness alone can leave unmasked fill at the end of the dash.

### Native anchors and late pins (Oct 2026)

Native fragment anchors resolve before idle-loaded motion runs. If a later ScrollTrigger pin adds a
spacer above the target, realign untouched deep links after pin creation and refresh; stop after user input.

### Pages of their own (Oct 2026)

- `/writing`, `/consultancy` and `/contact` use `layouts/Page.astro`: Base + the dock with `page=` set,
  so it is shown from the start and that tab is `aria-current="page"`. The dock has four tabs (About,
  Writing, Consultancy, Contact) so it still fits a 390px phone; Work and Path are the home page's own
  scroll and the mascot goes back to the top (home, on a page of its own).
- Writing is an Astro content collection (`src/content.config.ts`, markdown in `src/content/writing`,
  `_template.md` shows the frontmatter; files starting with `_` are ignored). Posts appear on /writing,
  at /writing/<slug>, in /rss.xml (@astrojs/rss) and in /sitemap.xml. No CMS. The empty-collection
  warning at build time is expected until the first post.
- /consultancy reuses `ModelLoader` + `Lanyard` (the buildspace badge) with the Leapfrog AI textures from
  `tools/consultancy-badge.mjs`. The still badge is the LCP; the physics load on first intent behind
  `lib/gl.ts` `canUseGL()` (the WebGL gate from odyn-astro-starter), never with reduced motion.
- /contact is a letter (`components/Letter.tsx`) with React Bits TearTicket (tear the stub to send) and
  PaperCrumple (crumple the draft to start over; three.js, loaded on first intent behind the GL gate).
  There is no form backend, so it sends through `mailto:` (`lib/letter.ts`), like the copy-email CTA.
- Model loader and stage styles live in `ModelLoader.css` (shared by the drawers and /consultancy).

### Project pages and the card transition (Oct 2026)

- Selected work links to `/work/<id>` (ids from `projects` in `data/site.ts`; `getStaticPaths` builds them, `sitemap.xml.ts`
  lists them). Old drawer links (`/#work/<id>`, `?project=<id>`) are redirected by a tiny inline script in the home head.
- Card to page is a native cross-document view transition (`styles/work-transition.css`, transitions.dev
  Page side-by-side): only the home page and the project pages import it, so no other navigation animates. The card face
  and phone carry `view-transition-name: work-<id>` / `phone-<id>`; the page hero repeats them. Names must stay unique per page.
- The Astro build does not emit the CSS of a dynamic `import()` inside an island: load such a stylesheet by `?url`
  (see `lib/lightbox.ts`).

### Contact letter intro (Oct 2026)

The letter starts as a crumpled ball (`assets/ball.webp`, a PaperCrumple frame) and unfolds in CSS from the first paint of
the server-rendered page: transform and opacity only, no script, no WebGL on load (WebGL on load cost Lighthouse 0.72).
The letter paints at once, scaled down under the ball, so it neither shifts layout nor delays LCP. PaperCrumple stays for
Start over only.

### Circular gallery on the path (Oct 2026)

- `Path.astro`'s strip is the real thing (scroller or GSAP-pinned track, `.stop` buttons, labels, focus order, the
  drawer triggers) and stays the fallback. `PathGallery.tsx` (`client:visible`, 200px margin) only adds a canvas over it,
  and only when `canUseGL()` allows; `lib/path-gallery.ts` (the React Bits Circular Gallery renderer, adapted; it uses raw
  WebGL2 now, not ogl) loads on that condition. It adds no layout, so `/#path` and everything below it cannot shift.
- Position comes from `stage.left - track.left`, which reads both the native scroll and the GSAP pin. Never feed it a drag or
  wheel state of its own; vertical wheel must keep scrolling the page. Each `.stop` is bent with a transform, so never read
  `getBoundingClientRect` of a stop for layout (the pin's focus-centering uses `offsetLeft`; a bounding box skewed it by 29px).
- No wrap-around: the first and last stop rest in the middle (`padding-inline: calc(50% - var(--stop-w) / 2)`, always, so the
  strip's length does not depend on the gallery). Measure the art from its top and width: a stop skipped by
  `content-visibility` reports 280px tall.
- Hover and press are transitions.dev recipe 11 (avatar group hover) on `.stop-btn`; the canvas mirrors its computed transform.

### FluidGlass on the footer heading (Oct 2026)

- `FluidGlass.tsx`/`.css` are the React Bits TS-CSS registry source, verbatim (raw WebGL2, no three.js). Integration lives in
  `ContactGlass.tsx`: an idle island that renders nothing until a pointer moves or taps while the footer is a quarter in
  view; only then does `canUseGL()` probe (no WebGL context before intent, `tests/perf`). Its shader setup is a ~400ms
  long task, so it must never start from a wheel or mid-scroll. Live reduced motion unmounts it. It is `client:idle`, not `client:visible`: an island that renders `null` has no box, so
  `client:visible` never fires.
- The canvas redraws the heading at its computed font, colour and line breaks (measured per character, because
  DecryptedText splits glyphs into cells and keeps a clipped screen-reader copy and hidden ghosts). The DOM `h2` only gets
  `data-glass` (transparent text) two frames after the glass mounts; it stays the accessible name. The layer is
  `pointer-events: none`; the library listens on `window`.


## CSS and motion rules (from good-css.com, adopted Oct 2026)

Every CSS or motion change follows https://good-css.com. Read the entry for your task before writing CSS. The rules this site depends on:

- **CSS over script.** Prefer one declaration that adapts on its own over breakpoints, and a CSS feature over JavaScript. JS only where it makes the result nicer, and the CSS must work without it. Nothing may write styles during a scroll or a swipe. The touch deck (`Work.css`, t144) is sticky plus scroll timelines, with zero style mutations.
- **Opt-in motion.** Movement and scale live inside `@media (prefers-reduced-motion: no-preference)`. Build the state first and add motion inside the query. Never strip motion afterwards with a global `0.01ms` rule. Opacity and color fades may stay outside. Script-driven motion checks the same query with `matchMedia`.
- **Scroll-driven animation.**
  - Use `animation-timeline: scroll()/view()` inside `@supports (animation-timeline: view())`, with a plain fallback (for example a plain sticky stack).
  - Write `animation-timeline` after the `animation` shorthand, or use longhands, because the shorthand resets the timeline.
  - Animate `transform` and `opacity` only, never layout or paint properties.
- **Motion tokens.**
  - Use `--ease-out` for anything entering or leaving and `--ease-in-out` for on-screen moves. Never use `ease-in` on UI.
  - Durations: ≤300ms for UI, 100–160ms for press feedback, 200–500ms for drawers and modals.
  - Always name the properties in a transition. Never write `transition: all`.
- **Hover only where hover exists.** Use `@media (hover: hover) and (pointer: fine)`, and give touch users `:active` press feedback at a scale of 0.95–0.98.
- **will-change.** Only while an effect is active. Compositor animations promote themselves, so never leave a standing `will-change`.
- **Clipping.** `overflow: clip` over `hidden`, because `hidden` makes a scroll container and breaks `position: sticky` inside it.
- **Shadows.** Cross-fade two pre-painted shadows with opacity; never transition `box-shadow` on many cards. Never animate an element that carries a `filter`/drop-shadow on scroll: re-rastering it cost the perf gate (see the 00e2709 phone parallax).
- **Layout.**
  - `svh` for heroes and documents, `dvh` only for app shells.
  - `scroll-padding-block-start` for anchors under the sticky dock.
  - `overscroll-behavior: contain` on inner scrollers (drawers).
- **Focus.** Use `:focus-visible` rings; never `outline: none`. Use `outline-color: transparent` when a shadow draws the ring.
- **Enter and exit from `display: none`.** Use `@starting-style` plus `transition-behavior: allow-discrete`; never start from `scale(0)`, use 0.95.
- **Every motion change:**
  - run `npx transitions-agent` and fix its findings on the touched files
  - keep the motion score from dropping
  - pass the CDP Pixel 7 drag script (`/workspace/jpA3/smooth.mjs`) at p95 < 17ms
