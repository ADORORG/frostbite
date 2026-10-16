# `@ador/feature-game-admin`

Staff administration of games' rewards contracts: define a milestone (with its drawing), pause and resume claims, review and sign each
step, and the log of what was done. Decisions: ADR-018 Amendment 3 (no platform key; staff sign every step by hand; any staff member may
pause and resume; every step logged). Service and table: `@ador/game-admin`. Plan: `docs/product/plan-g7-minting.md` (G7f).

## Public API

`createGameAdminFeature(games, config)` returns the feature registration: four API routes and two admin pages. Register it once in
the feature registry (`configs/features.ts`); removing that line removes every route, page and navigation entry.

| Operation              | Route                             | Notes                                                         |
| ---------------------- | --------------------------------- | ------------------------------------------------------------- |
| `startGameAdminStep`   | `POST /api/v1/game-admin/start`   | Builds the step; an answer (with why) when it cannot be taken |
| `submitGameAdminStep`  | `POST /api/v1/game-admin/submit`  | Takes what was signed; checked against what was built         |
| `refreshGameAdminStep` | `POST /api/v1/game-admin/refresh` | Looks at the chain once; the page asks until the step is over |
| `listGameAdminSteps`   | `POST /api/v1/game-admin/list`    | A game's log, oldest first, with the people named             |

| Page         | Path                    | Notes                                                                            |
| ------------ | ----------------------- | -------------------------------------------------------------------------------- |
| Game rewards | `/admin/games`          | Games that declare rewards, and whether each has a contract                      |
| One game     | `/admin/games/[gameId]` | Wallet, pause and resume, milestones and their drawings, the review, and the log |

Everything requires `game:administer` (`gameAdminCapability`), which the authorization policy grants to the `staff` role.

## Configuration

`GameAdminConfig` (`configs/game-admin.ts`): the chain the platform builds, sends and watches on and the contract deployed for each
game (both from `configs/game-rewards.ts`, shared with player claims so the two cannot disagree), the sanitiser's limits, and each
contract's own drawing limit. A game with a contract and no drawing limit stops the platform from starting. **Nothing is configured
today** (no contract is deployed, no chain adapter is set up), so the pages open and say so: a step cannot be built.

## Behaviour worth knowing

- **Signing.** No wallet in this version signs administration steps, so the review shows the transaction to sign and a box for the
  signed result (a wallet that can sign is injected as `sign` when one is qualified). The platform checks what comes back is exactly
  what it built and showed; nothing else is sent.
- **Nothing is called done early.** A step is "complete" only when the network's records show it; "Confirmed, not yet indexed" and
  "Sent, waiting" are separate.
- **A milestone is defined once.** The page shows the log's standing and hides the form once a definition completed; the contract
  refuses a second definition too. Pausing and resuming are one change at a time.
- **The pause state shown is what staff did**, from the log, not read from the contract.
- Starting a step needs the staff wallet's address; on Bitcoin the output holding the game's auth token as well (`txid:vout`).

## Tests

`pnpm --filter @ador/feature-game-admin test:unit` (presenter, operations, client, registration, the panel and review against a fake
API), `test:integration` (the four operations over real PostgreSQL and the simulated chain), `test:coverage`. Browser, accessibility,
keyboard, reduced-motion, responsive and visual behavior: `tests/e2e/tests/game-admin.spec.ts`.

## Ownership

The games platform owner.
