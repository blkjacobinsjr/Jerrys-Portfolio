# Handoff

## E3 hero (t154, shipped)
- Desktop with a fine pointer only: opens on the v3 Berlin screen full-bleed; scroll spins a 3D laptop onto the desk
  (`src/scripts/hero-laptop.ts`, landing pose solved with OpenCV solvePnP from the drawn screen corners), then hands
  off to `desk-landed.webp`. Phones, touch, reduced motion, browsers without CSS scroll timelines: production hero, no E3 bytes.
- Revert in one line: `HERO_ZOOM = false` in `src/data/site.ts`. `?zoom=off` disables it for one visit.
- Assets: `src/assets/icons/{screen-v3,desk-nolaptop,desk-landed}.webp`, `public/hero-screen-v3.webp` (3D screen texture).
  The bare desk was inpainted with gemini-3-pro-image (`/workspace/shots/e3/desk/inpaint.py` on the box).

## Later
- **Ultramock swap:** replace the procedural three.js laptop with an ultramock.io mock export (glTF, Draco/meshopt,
  ≤300KB, screen material mapped to the v3 texture). Jerry has ultramock open in Brave on his Mac; it must be exported
  there. Keep the solvePnP landing pose: the export's screen corners must be re-mapped to the lid frame in hero-laptop.ts.

## Ultramock laptop preview (2026-10-24, branch preview/ultramock-laptop, not main)
- Flag `ULTRAMOCK_LAPTOP` in src/data/site.ts ('preview': off in Vercel production; previews need ?um=1, kept per tab session, ?um=0 clears).
- src/scripts/hero-frames.ts scrubs 90 WebP frames (public/hero-um, 1.47 MB) on the E3 canvas instead of three.js; loads only on desktop E3 after the first intent.
- Source: Ultramock "My first project", 3.0 s, 2560x1440 VP9 alpha 60fps; keyframes Rotate Y -155@0 -> 25@2.7, lid 40@0 -> 110@2.3, zoom 8.5@0 -> 10@2.7, camera X35 Y0 FOV18 pan 0/0. Master: /workspace/assets/ultramock/ultramock-spin-1440p60-alpha.webm; bake script frames.py, alignment align.py (SIFT similarity to desk-v3).
