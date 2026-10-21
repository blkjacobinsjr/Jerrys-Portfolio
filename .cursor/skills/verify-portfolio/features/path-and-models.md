# Path and interactive models

Visitors choose a career stop, read the adjacent stops and request a 3D view only where it is relevant.

## Sub-features

- path.drawer: a stop opens the shared drawer and Escape restores focus.
- path.wheel: selected stop and the two neighbors are visible; arrow keys navigate.
- model.desk: Berlin desk imports on tap, renders and rotates.
- model.lanyard: Buildspace badge imports on tap and flips from its control.
- model.fallback: loading is visible, failures retain readable static content, and retry handles recoverable failures.

## How to get to it (user POV)

Scroll or use Path in the dock. Tap My Berlin desk or buildspace. The option wheel is under the caption in the same drawer.

## Driving it with Playwright

Preconditions: owned preview, fresh context, reduced motion for deterministic navigation.

- Before a tap, resource timing must have no Desk, Lanyard or three.module request and no model canvas.
- Click `[data-stop="desk"]`; observe `data-model-state="loading"`, then `ready`, and operate Rotate desk right. Closing the drawer removes its canvas.
- Click `[data-stop="buildspace"]`; await ready and use Flip badge. Reduced-motion dragging must not cause an accidental flip.
- Focus `getByRole('listbox', { name: 'Stops on the path' })`; selected buildspace has WBS Coding School before and Draper University after. ArrowDown opens Draper University.
- Run `tests/e2e/model-lifecycle.spec.ts` for real intercepted chunk/image failures, fallback artwork and retry; run `tests/unit/interaction.test.ts` for state transitions.

## Gotchas

On a pinned desktop path, focus a stop first so it scrolls into view. Wheel changes settle before the drawer content changes. WebGL unavailability must show a static fallback with readable content and a clear status. A fallback is not evidence of a successful 3D render. Browser emulation does not prove physical-device feel.
