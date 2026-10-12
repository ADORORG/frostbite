# G2 Game generator and conformance in test-kit

Branch `feat/game-generator-conformance`, stacked on `docs/adr-018-accepted` (`0fbd6f1`). Decisions (owner,
2026-10-12): a command `pnpm game:new <id>`, and the conformance runner enforced automatically over every game.

## What was built

- `@ador/test-kit/simulated-game-host` (moved from `@ador/game-sdk/conformance`, with its tests and fixture) and
  `@ador/test-kit/game-conformance`: `checkGameConformance({ folder, game })` returns what is wrong with a game
  folder: page the frame cannot serve, script that does not bundle, never ready, any call the platform refused,
  anything thrown uncaught. Empty means conforming. `createMemoryGameBackend` is the backend it uses.
- `apps/web/test/games-conformance.unit.test.ts`: runs it over every registered embedded game, and fails if a
  folder under `/games` is not registered or a registered embedded game has no folder. Nobody has to remember.
- `tooling/game-tools` (`@repo/game-tools`, new): `pnpm game:new <id> [--title]` copies `games/sample-game`,
  writes `configs/games/<id>.ts`, and inserts one import and one list entry above the `game:new` markers in
  `configs/games.ts`. Every input is checked before anything is written; any refusal changes nothing.
- Docs: onboarding guide step 1 and the conformance section; ledger GP-03 and GP-04 marked completed.

## Evidence

- A real run in the repository: `pnpm game:new demo-game` made a game whose own unit (9) and integration (6)
  tests, typecheck and lint pass, and the automatic conformance test registered and passed it (the existing
  exact-list test failed, as it should when a game is added). The demo was then removed; the tree and lockfile are
  clean of it.
- Integration test on a copy of the template: copy without build leftovers, rename, a manifest that passes
  `gameManifestSchema`, the generated game passes `checkGameConformance`, two games register once each above the
  markers, nine refusals leave the registry byte-identical.
- Gates: format, env check (26), lint (43 + policy, 43 workspaces), typecheck (43). Coverage: game-tools
  100/91.66/100/100, test-kit 99.09/96.51/98.23/99.42, game-sdk 99.29/97.54/100/99.61; web unit 55, sample game 15.
- Mutants: 19 (6 on the check, 13 on the generator), all killed.

## Not done / notes

- "A generated second game onboards with no platform-core edits" is proven at the GP-11 gate with a real second
  game, not here. The generated manifest keeps the sample's description and milestones until the author edits them.
- The conformance check cannot see a game that works in the simulation and fails in a browser; the real-browser
  isolation spec still covers the sample game only.
- The formal three-pass convergence review was not run.
