# Handoff

## Enter screen: oil lens + sound (t186, preview/enter-timeless)

- Name: apple-music-effect (vendored unmodified in src/vendor/apple-music-effect, MIT, see COMMIT) plays its 4 s sting with a 'J' tile and then the "Jerry DOUGHAN" wordmark, fitted exactly on the DOM text. Adapter: src/lib/enter-oil.ts. "Enter with sound" plays the wordmark shot on hover or focus-visible. Desktop with a fine pointer only, never under reduced motion; loads after `load`; stops at the click.
- Sound (src/lib/sound.ts): the click plays Cuelume `tap` (UI cue, unlock in the gesture) with the ElevenLabs oil drop and air swell, all decoded on intent. The ElevenLabs jazz bed (public/sfx/jazz.*) is fetched after the click and plays 3 passes, then fades out. It ducks under the footer, follows mute, and fades when the tab is hidden. Provenance: public/sfx/README.md. Panel: reports/sound-panel.md.
- Open: the ElevenLabs Music API needs a paid plan (402), so the bed is an SFX loop. The real-GPU frame rate of the lens has not been measured.

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
