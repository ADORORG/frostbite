# A real-time cabinet that can be replayed: SAT SNAKE (G6d, #63)

Branch `feat/replayable-realtime-cabinet`, stacked on `chore/shared-vitest-config`; baseline `7f1ee36`. Plan and decisions:
`docs/product/plan-g6d-realtime-cabinet.md`. Specification: `docs/product/run-record.md`.

## What it is

One of FROST·BITE's nine real-time cabinets, the snake, ported to a fixed-step simulation. The screen's timer calls the rules'
`moveOnce` once a tick; the run record holds the player's turns and the tick each was made on (`turn { dir, tick }`) and a
closing `end { tick }`. The platform replays that record with the same rules and, if the snake reached ten links, holds
`snake-ten` as `replay-verified` on the account. The platform was not changed to learn any of this.

## What was built

- **`@ador/game-sdk/cabinets`** (new, generic): `cabinet(rules)` and `combineCabinets({ id, version, cabinets })` make one
  verifier from several cabinets' rules; a record names its cabinet in `config.cabinet`; the rest of the settings go to that
  cabinet. No `any`/`unknown`: each cabinet's state sits behind the functions that work on it.
- **Rules** (`games/frostbite/src/verifier`): `snake.ts` (state machine: `turn`, `end`, `moveOnce`, `advanceTo`),
  `snake-board.ts` (geometry, seeded mines and food), `seeded.ts` gained `stepSeed` (the generator as a function of its state),
  `frostbite.ts` (the combined verifier, id `frostbite`, version 2).
- **Cabinet** (`src/snake`): session (no clock, no screen), grid, pad, keys, panel, mount, CSS. Shared with the ice field and moved
  to `src/cabinet`: the host type, `usePlatformRun` (begin a run, send the record; the ice field now uses it too), record
  view, seed, mark naming.
- **Manifest** `configs/games/frostbite.ts`: version 0.4.0, verifier `frostbite` v2 with the re-pinned digest
  (`09fb43aa…1096`), milestone `snake-ten` declared `replay-verified`.
- **Tests:** rules, board, session, screen (fake timers), platform runs, keys and mount; the platform's registry replaying the
  cabinet's own record; a real-browser spec (`tests/e2e/tests/sat-snake.spec.ts`, signed in and out, a refused reversal, a
  baseline); a test player (`test/support/snake-solver.ts`) that plays the rules to win.

## Found along the way

- A test of the key map found that a key named like something every object has (`constructor`, `__proto__`) was read as a
  direction through the prototype chain; the map is now a `Map`.
- The original let two quick key presses reverse the snake onto its neck; the port checks against the way it last moved.
- The original could put food on a mine. The port never does.
- `tooling/game-tools` has no unit tests, so `pnpm test:unit` there exits 1 (predates this work; task #68).
- The ice-field cabinet's records now carry `cabinet: "ice-field"` and verifier `frostbite` v2; its tests, e2e record and
  the manifest were updated. No live data exists, so nothing is migrated.

## Verification (run on this branch)

- **Mutation proof:** 27 breaks of the rules, board, session, screen, hook and the SDK helper; the first run left 3 alive (food
  stream independent of the mine stream, a redundant guard in the session which was removed, the screen's guard against a key
  after the run ended); two tests were added; all killed on the re-run. The working tree was restored after each run.
- **Coverage (statements / branches / functions / lines):** `@game/frostbite` 99.2/95.4/100/100 (its config now measures `src/cabinet` and `src/snake` too); `@ador/game-sdk` 98.3/96.9/98.6/98.4. `pnpm test:coverage` passed for all 47 workspaces.
- `pnpm format:check`, `pnpm lint` (47 workspaces, repository policy), `pnpm typecheck`: passed. Web integration (80 tests,
  including the claim-path flow against real PostgreSQL) passed. The two spec files for the cabinets passed three times in a row.

## Not done

The other eight real-time cabinets; retiring the legacy snake; a leaderboard (#54); anything that shows a person steered.

## Full end-to-end run

387 passed, 134 skipped (project-specific), 0 failed, on a fresh production build. The first full run had 13 failures, all
consequences of FROST·BITE now declaring a fourth milestone and a new version: counts ("1/3", "0 of 3 reached"), and the
game-detail and games-list baselines (the version, the milestone count, the declarations digest), which were checked
against the diff image and regenerated (eight files, no other baseline changed). A rerun of five specs after that showed one
failure that I could not reproduce in five further runs of the same specs, and the final full run was clean; I did not find
its cause.
