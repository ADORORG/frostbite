# Game gate evidence (G9, GP-11)

The gate: "a generated second game onboards with no platform-core edits, and a milestone mints on the test network." It has two halves. The first is checked below, on 2026-11-10. The second needs a person with a wallet and is still open.

## Half 1. A generated game onboards with no platform-core edits (checked)

Run on a scratch branch from `dev` at `84645700`, then removed so nothing of it remains:

1. `pnpm game:new gate-trial --title "Gate Trial"` created `games/gate-trial/` and `configs/games/gate-trial.ts`, and changed one existing file, `configs/games.ts`, by two lines (an import and a list entry, above the markers `game:new adds ... above this line`). Nothing under `apps/`, `packages/` or `features/` changed. `pnpm-lock.yaml` gained the new workspace.
2. The generated game's own checks passed: 38 unit tests, 13 integration tests, typecheck and lint.
3. The platform's cross-game tests, which read the registry rather than a list, covered it without being touched: `games-conformance` (a source folder for every embedded game and every folder listed, and the conformance check), `games-layout`, `games-config` and `games-verifiers` (4 files, 18 tests, all passing, and the verifier test passed again after the game was built).
4. `apps/web/scripts/build-games.ts` built it with the others and served `index.html`, `main.js`, `styles.css`, `verifier.js` and `verifier.json` under `public/play/gate-trial/`. The built `verifier.js` has the digest the generated manifest pins (`79a477a0...24c3`), so the platform loads its replay verifier.
5. The generated manifest declares four replay-verified milestones and a rewards contract, so its milestones go through the same run, verify and claim path as every other game (covered for the platform by the G6, G7 and G8 tests).

What this does not show: it ran no browser, and it did not play the generated game. The template's behaviour in a real browser is covered by the existing end-to-end specs for the games already built from it.

## Half 2. A milestone mints on the test network (open, needs the owner)

The platform side is tested end to end on the simulated chain (`game-claims-flow.integration.test.ts` and the claim tests in `packages/game-claims`), and the signet has been used for real (task PIC-1 was seen on signet). What nobody but a person with a wallet can show is a real mint from a game made with `game:new`. To close it, on the deployed test network:

1. As staff, create the game's rewards contract for the generated game (Game rewards page: publish the templates if they are not published, then create the game contract and wait for it to complete), then define the milestone you will earn.
2. As a player with a wallet, play the game until a replay-verified milestone is earned, open the game's page, and press Claim. Sign in the wallet.
3. Wait until the claim shows complete, and open the transaction from the explorer link.

When that is done, record the game, the milestone and the transaction id here, and mark G9 closed.
