# Handoff

## E3 hero (t154, shipped)
- Desktop with a fine pointer only: opens on the v2 Berlin screen (Jerry, 2026-10-24 12:32) full-bleed; scroll spins a 3D laptop onto the desk
  (`src/scripts/hero-laptop.ts`, landing pose solved with OpenCV solvePnP from the drawn screen corners), then hands
  off to `desk-landed.webp`. Phones, touch, reduced motion, browsers without CSS scroll timelines: production hero, no E3 bytes.
- Revert in one line: `HERO_ZOOM = false` in `src/data/site.ts`. `?zoom=off` disables it for one visit.
- Assets: `src/assets/icons/{screen-v2,desk-nolaptop,desk-landed}.webp`, `public/hero-screen-v2.webp` (3D screen texture).
  The bare desk was inpainted with gemini-3-pro-image (`/workspace/shots/e3/desk/inpaint.py` on the box).

## Later
- **Ultramock swap:** replace the procedural three.js laptop with an ultramock.io mock export (glTF, Draco/meshopt,
  ≤300KB, screen material mapped to the v2 texture). Jerry has ultramock open in Brave on his Mac; it must be exported
  there. Keep the solvePnP landing pose: the export's screen corners must be re-mapped to the lid frame in hero-laptop.ts.
