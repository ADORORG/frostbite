# Full screen button for games

Branch `feat/game-fullscreen`, on top of `feat/frostbite-on-sdk` (`45ad42e`). Requested by the owner (2026-10-12): a
full screen option for games.

## What was built

- A **Full screen** button on the game panel (`features/games`, `use-fullscreen.ts`). It is offered only where the
  browser says full screen is allowed (`document.fullscreenEnabled`; hidden on the server render so the markup agrees),
  asks the browser to show the game's frame full screen (the frame already had `allow="fullscreen"`), and says so if the
  browser refuses ("The browser did not allow full screen"). A line under it says Esc leaves.
- Design found by the real browser: an "Exit full screen" button on the page can never be pressed, because the frame
  then covers the whole screen. The first version had one and its e2e failed for that reason; it was removed. Leaving
  is the browser's own (Esc), which the browser also announces.

## Evidence

Typecheck, lint, format; feature-games 55 tests (button hidden when unsupported, enters on request, hint, refusal
shown and cleared); real-browser spec `game-fullscreen.spec.ts` on all four viewports (offered exactly where the
browser allows it; keyboard Enter takes the frame, not the page, full screen; the game still works while full screen;
leaving returns the page); game snapshots regenerated, stable on a second run; 6 mutants, all killed.

## Not done

A whole-panel full screen that would keep platform controls on screen (the milestone summary, a visible exit); not
asked for. Safari on iPhone does not allow element full screen, so the button is not shown there (by design).
