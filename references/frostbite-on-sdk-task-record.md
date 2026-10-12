# G5 FROST·BITE on the SDK

Branch `feat/frostbite-on-sdk`, stacked on `feat/game-generator-conformance` (`1d3de45`). Source: the pre-platform
game at `/home/abioye/frostbite/frostbite-game` (outside this repository, not under git). Owner decisions
(2026-10-12): remove the server call; bring in FROST·BITE only; leave out the admin console, the submission inbox
and the arcade; propose three milestones for approval.

## What was built

- `games/frostbite` (`@game/frostbite`): the game as one bundle (React 19 from the repo, fonts from
  `@fontsource/*` 5.3.0, OFL-1.1) in the isolated frame. `src/main.ts` gives the old code what it expects:
  `window.React`/`ReactDOM`, a `localStorage` (the SDK storage shim; three keys saved through `progress.save`),
  and `window.FrostbiteHost.milestone` (reports a mark only if the manifest declares the same-named milestone).
- `src/legacy/`: the old code, copied, identified (README: what changed, refactoring plan), exempt from the line
  policy by path (`legacyDirectories`) and from prettier/eslint; it may only shrink. Changes to it: `alkanes.jsx`
  rewritten simulation-only (the live backend and `fetch("/api/run")` removed, as decided); `app.jsx` lost the
  "Build a cabinet" venue and the arcade bridge and `mark()` reports to the platform; `wallet.jsx` says on every
  step that it is a demo (it claimed to connect a wallet and sign a session).
- SDK: `bundleGameStyles` (`styles.css` bundled with its `@import`s; fonts and images emitted beside it under
  hashed names; remote references fail the build) and `./storage-shim`.
- Platform: `configs/games/frostbite.ts` is `embedded`; the game frame is `min(85vh, 60rem)` tall (a game built for
  a window cannot be played in a 32 rem strip); env docs and the preview checklist say `GAME_LAUNCHES` is for games
  at an address of their own (none today); repository policy gained `legacyDirectories` with a README check.
- Tests: bridge and storage-key guard (unit), the whole game bundled and run in the simulated host (integration),
  automatic conformance (web), a real-browser spec `frostbite.spec.ts` (boots with no error and no outside
  request, enters the arcade, the game's `localStorage` reaches the platform and is back after reload, fetch and
  cookies blocked, the page's claims), web config tests rewritten, game snapshots regenerated.

## Evidence

format, env check (27), lint (44 + policy, 44 workspaces), typecheck (44). Unit/integration: game-sdk 113, games
feature 51, frostbite 11, repository-policy 32, config 72. Coverage: game-sdk 99.4/97.94/100/99.67, feature-games
97.34/96.2/95.91/98.09, frostbite platform modules 100%, policy 96.77/93.93/100/96.66 (`src/main.ts` is exercised
by the integration test, which v8 cannot attribute to the bundle). e2e: a first full run had 299 passed and 20
failed, all in specs that assumed FROST·BITE was "not playable yet" or its frame size; the specs were updated and
re-run. Two later full runs each failed one spec, both fixed: the game-detail picture (the frame's animated inside, now left blank in that picture) and a latent race in `platform-hardening.spec.ts` (two specs shared one user's rate-limit window; it now has its own user). The last full run: 319 passed, 21 skipped by design, 0 failed.
Mutants: 17 on the new code, all killed.

## Needs the owner

- **Milestones.** None is declared yet. The game's own marks are `firstPick`, `firstWin`, `firstBust`,
  `firstGlacier`, `firstCashout`, `firstKots`, `firstCore`, `firstDog`. Proposed three: `first-win`,
  `first-glacier`, `first-cashout`. To declare one, add it to `configs/games/frostbite.ts` with the id in slug form;
  the game reports it with no further change. Self-reported only: nothing with value depends on them.

## Not done / notes

- The game is a simulation: board fairness, icicles, the house signer and GLACIER are fakes, as before, and the
  page says so. Real chain actions belong to minting (G7).
- The legacy code is not refactored (about 9,400 lines of JSX; plan in its README) and is not linted.
- A tweaks panel from the old design tool is still in the code; it only shows when a host asks for it
  (`__edit_mode`), which the platform never does. It includes cheat switches (`unlockAll`).
- The game keeps its telemetry log in memory for the visit only; it was never sent anywhere.
- Formal three-pass convergence review not run.
