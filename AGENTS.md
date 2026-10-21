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
