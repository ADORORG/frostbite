# Game gate evidence (G9, GP-11)

The gate: "a generated second game onboards with no platform-core edits, and a milestone mints on the test network." It has two halves. Both were checked on 2026-11-10: the first by running it (below), the second by the owner.

## Half 1. A generated game onboards with no platform-core edits (checked)

Run on a scratch branch from `dev` at `84645700`, then removed so nothing of it remains:

1. `pnpm game:new gate-trial --title "Gate Trial"` created `games/gate-trial/` and `configs/games/gate-trial.ts`, and changed one existing file, `configs/games.ts`, by two lines (an import and a list entry, above the markers `game:new adds ... above this line`). Nothing under `apps/`, `packages/` or `features/` changed. `pnpm-lock.yaml` gained the new workspace.
2. The generated game's own checks passed: 38 unit tests, 13 integration tests, typecheck and lint.
3. The platform's cross-game tests, which read the registry rather than a list, covered it without being touched: `games-conformance` (a source folder for every embedded game and every folder listed, and the conformance check), `games-layout`, `games-config` and `games-verifiers` (4 files, 18 tests, all passing, and the verifier test passed again after the game was built).
4. `apps/web/scripts/build-games.ts` built it with the others and served `index.html`, `main.js`, `styles.css`, `verifier.js` and `verifier.json` under `public/play/gate-trial/`. The built `verifier.js` has the digest the generated manifest pins (`79a477a0...24c3`), so the platform loads its replay verifier.
5. The generated manifest declares four replay-verified milestones and a rewards contract, so its milestones go through the same run, verify and claim path as every other game (covered for the platform by the G6, G7 and G8 tests).

What this does not show: it ran no browser, and it did not play the generated game. The template's behaviour in a real browser is covered by the existing end-to-end specs for the games already built from it.

## Half 2. A milestone mints on the test network (confirmed by the owner)

The owner tested a real mint on the test network on 2026-11-10 and confirmed it worked. No transaction id was given to the author of this note, so none is recorded here; add the game, the milestone and the transaction id below if you want the record complete.

The platform side is also tested end to end on the simulated chain (`game-claims-flow.integration.test.ts` and the claim tests in `packages/game-claims`).

| Game | Milestone | Transaction |
| ---- | --------- | ----------- |
|      |           |             |

## Result

Both halves hold, so G9 (GP-11) is closed.
