# Agent notes: Jerry's portfolio

Read this before changing the site. The QA gate is `npm run qa` (see `.cursor/skills/verify-portfolio`).
Never lower a threshold, skip a journey or delete an assertion to get green.

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
- Every overlay (drawer, sheet, modal, lightbox, menu) is built with `src/components/Drawer.tsx`.
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
