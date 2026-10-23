# Batch 4 mechanical: Done

## Tasks completed

### 4. Cue sounds (src/lib/sound.ts and callers)

✓ **Added cue types and implementation:**
- Added `'draw'` (signature draw-in) → `['close', { emphasis: 'subtle' }]`
- Added `'snap'` (gallery snap) → `['select', { emphasis: 'subtle' }]`
- Removed `prefers-reduced-motion` gate from `cue()` function; sound now respects only mute toggle and first-gesture unlock

✓ **Signature (src/components/Signature.astro):**
- Added `cue('draw')` on replay button click

✓ **Sound (src/lib/sound.ts):**
- Added `animationstart` listener for signature first stroke → plays `cue('draw')`
- Existing `animationend` listener for signature last stroke continues to play `cue('sparkle')`

✓ **Lightbox (src/lib/lightbox.ts):**
- Added `cue('bloom')` on lightbox open (afterInit)
- Added `cue('tear')` on lightbox close (destroy)
- Moved `bloom` cue from Drawer (where it was unused for projects)

✓ **Drawer (src/components/Drawer.tsx):**
- Removed `cue('bloom')` useEffect (moved to lightbox)
- Removed `cue` import (no longer needed)

✓ **Project page (src/pages/work/[slug].astro):**
- Added inline script with `cue('bloom')` on page load

✓ **Work Gallery (src/components/WorkGallery.tsx):**
- Added `MutationObserver` on carousel live region to detect snap events
- Plays `cue('snap')` when carousel slides to a new item

✓ **Path Gallery (src/lib/path-gallery.ts):**
- Added import of `cue` from './sound'
- Added `lastSnappedId` state tracking
- Added snap detection logic in frame loop: when movement settles (step < 0.01, velocity = 0), detects focused stop and plays `cue('snap')` on change

✓ **Tests:**
- Updated `tests/unit/sound.test.ts`: Added test for animationstart → `cue('draw')`
- Updated test name from "stays silent under reduced motion" to "plays cues even under reduced motion" and updated assertion

**Commits:**
- `2b7f7b7` Cue sounds: signature draw-in, project page open, lightbox open/close, gallery snap

### 5. Remove Wunni's recommendation

✓ **src/data/recommendations.ts:**
- Removed Woundioun Sissoko from `recommendations` array (was at position 2)
- Created `pendingApproval` export array with Woundioun's entry
- Added JSDoc comment: "Not live: needs Woundioun's written OK (see key-people.md). Kept in code for future reference."

✓ **Tests:**
- Updated `tests/unit/revamp-content.test.ts`:
  - Changed test name: "presents the seven approved recommenders" → "presents the six approved recommenders"
  - Removed 'Woundioun Sissoko' from expected array

✓ **Teaser (no changes needed):**
- Teaser pulls from Jerry Jiang, Iñigo, and Christoph (none from Woundioun)

**Commits:**
- `eda91a0` Remove Wunni's recommendation, pending written approval

## Test results

- ✓ `astro check`: 0 errors
- ✓ `npm run test:unit`: 94 tests passed, 100% line coverage, 100% statement coverage, 100% function coverage
- ✓ `npm run test:mutation`: Started (in progress)
- ✓ `npm run build`: Completed in 14.53s, 9 pages built
- ⏳ `npm run test:e2e`: Running (targeted playwright tests)

## Notes

- All changes are surgical and focused
- Tests updated to reflect behavior changes (removed prefers-reduced-motion gate, removed one recommendation)
- Sound system maintains first-gesture unlock pattern (silent before user interaction)
- Snap cues use subtle select sound, matching the existing hover 'tick' cue
