# `@ador/feature-game-admin`

Staff administration of games' rewards contracts: publish the templates, create a game's contract, define a milestone (with its
drawing), pause and resume claims, review and sign each step, and the log of what was done. Decisions: ADR-018 Amendment 3 (no platform key; staff sign every step by hand; any staff member may
pause and resume; every step logged). Service and table: `@ador/game-admin`. Plan: `docs/product/plan-g7-minting.md` (G7f).

## Public API

`createGameAdminFeature(games, config)` returns the feature registration: six API routes and two admin pages. Register it once in
the feature registry (`configs/features.ts`); removing that line removes every route, page and navigation entry.

| Operation                 | Route                               | Notes                                                                   |
| ------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `startGameAdminStep`      | `POST /api/v1/game-admin/start`     | Builds the step; an answer (with why) when it cannot be taken           |
| `submitGameAdminStep`     | `POST /api/v1/game-admin/submit`    | Takes what was signed; checked against what was built                   |
| `refreshGameAdminStep`    | `POST /api/v1/game-admin/refresh`   | Looks at the chain once; the page asks until the step is over           |
| `recordGameAdminContract` | `POST /api/v1/game-admin/record`    | Staff enter a contract's address the platform could not read; checked   |
| `listGameAdminSteps`      | `POST /api/v1/game-admin/list`      | A game's log, its contract (once made), whether the templates are ready |
| `listGameAdminTemplates`  | `POST /api/v1/game-admin/templates` | The templates that may be published, which are and where, and their log |

| Page         | Path                    | Notes                                                                                        |
| ------------ | ----------------------- | -------------------------------------------------------------------------------------------- |
| Game rewards | `/admin/games`          | The templates (publish each at an address you choose), and the games that declare rewards    |
| One game     | `/admin/games/[gameId]` | Create the contract once; then wallet, pause and resume, milestones, the review, and the log |

Everything requires `game:administer` (`gameAdminCapability`), which the authorization policy grants to the `staff` role.

## Configuration

`GameAdminConfig` (`configs/game-admin.ts`): the chain the platform builds, sends and watches on (`configs/game-rewards.ts`, shared with
player claims so the two cannot disagree), the rewards plan (`configs/rewards-plan.ts`: the chain, which templates may be published,
which a game and its collectibles are made from, the most a contract may be created to accept) and the sanitiser's limits.
**Where templates and contracts are is not configuration**: it is recorded when the steps that put them there complete, and read from
`ador.published_templates` and `ador.game_contracts`. With no node address set the pages open and say a step cannot be built.

## Behaviour worth knowing

- **Signing.** No wallet in this version signs administration steps, so the review shows the transaction to sign and a box for the
  signed result (a wallet that can sign is injected as `sign` when one is qualified). The platform checks what comes back is exactly
  what it built and showed; nothing else is sent.
- **Nothing is called done early.** A step is "complete" only when the network's records show it; "Confirmed, not yet indexed" and
  "Sent, waiting" are separate.
- **A milestone is defined once.** The page shows the log's standing and hides the form once a definition completed; the contract
  refuses a second definition too. Pausing and resuming are one change at a time.
- **The pause state shown is what staff did**, from the log, not read from the contract.
- Starting a step needs the staff wallet's address; on Bitcoin the output holding the game's auth token as well (`txid:vout`), for the
  steps that spend it (defining a milestone, pausing). Publishing a template and creating a contract spend no token.
- **A game with no contract shows only how to get one**: the contract card (create it, or why not yet) and the log. Pause, resume and
  milestones appear once the record has the contract. The page loads the record again when a step ends.
- **The address a template goes to is the one staff type**, checked against the record (not already published, not used by anything
  else); the address of a game's contract is whatever the chain reports.

## Tests

`pnpm --filter @ador/feature-game-admin test:unit` (presenter, operations, client, registration, the panel, the contract card, the templates panel and
review against a fake API), `test:integration` (the operations over real PostgreSQL and the simulated chain: publish both templates, create
a game's contract, then administer it), `test:coverage`. Browser, accessibility,
keyboard, reduced-motion, responsive and visual behavior: `tests/e2e/tests/game-admin.spec.ts`.

## Ownership

The games platform owner.
