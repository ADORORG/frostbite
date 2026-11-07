# `@frostbite/feature-game-admin`

Staff administration of games' rewards contracts: publish the templates, create a game's contract, define a milestone (with its
drawing), pause and resume claims, review and sign each step, and the log of what was done. Decisions: ADR-018 Amendment 3 (no platform key; staff sign every step by hand; any staff member may
pause and resume; every step logged). Service and table: `@frostbite/game-admin`. Plan: `docs/product/plan-g7-minting.md` (G7f).

## Public API

`createGameAdminFeature(games, config)` returns the feature registration: ten API routes and two admin pages. Register it once in
the feature registry (`configs/features.ts`); removing that line removes every route, page and navigation entry.

| Operation                 | Route                                  | Notes                                                                   |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `startGameAdminStep`      | `POST /api/v1/game-admin/start`        | Builds the step; an answer (with why) when it cannot be taken           |
| `submitGameAdminStep`     | `POST /api/v1/game-admin/submit`       | Takes what was signed; checked against what was built                   |
| `refreshGameAdminStep`    | `POST /api/v1/game-admin/refresh`      | Looks at the chain once; the page asks until the step is over           |
| `recordGameAdminContract` | `POST /api/v1/game-admin/record`       | Staff enter a contract's address the platform could not read; checked   |
| `listGameAdminSteps`      | `GET /api/v1/game-admin/list?gameId=`  | A game's log, its contract (once made), whether the templates are ready |
| `listGameAdminTemplates`  | `GET /api/v1/game-admin/templates`     | The templates that may be published, which are and where, and their log |
| `listGameMints`           | `GET /api/v1/game-admin/mints`         | A game's totals and a page of its completed mints (`gameId`, `after`)   |
| `listGameMintTotals`      | `GET /api/v1/game-admin/mint-totals`   | The totals of every game that declares rewards                          |
| `getPlatformFee`          | `GET /api/v1/game-admin/platform-fee`  | The platform fee on each chain: in force, who set it, the history       |
| `setPlatformFee`          | `POST /api/v1/game-admin/platform-fee` | Sets the fee and its treasury address together, as the signed-in staff  |

| Page         | Path                    | Notes                                                                                                                    |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Game rewards | `/admin/games`          | The templates, **the platform fee** (fee and treasury address side by side), and the games, each with its mints and fees |
| One game     | `/admin/games/[gameId]` | Create the contract once; then wallet, pause and resume, milestones, the review, the log, **mints and fees**             |

Everything requires `game:administer` (`gameAdminCapability`), which the authorization policy grants to the `staff` role.

## Configuration

`GameAdminConfig` (`configs/game-admin.ts`): the chain the platform builds, sends and watches on (`configs/game-rewards.ts`, shared with
player claims so the two cannot disagree), the rewards plan (`configs/rewards-plan.ts`: the chain, which templates may be published,
which a game and its collectibles are made from, the most a contract may be created to accept) and the sanitiser's limits.
**Where templates and contracts are is not configuration**: it is recorded when the steps that put them there complete, and read from
`frostbite.published_templates` and `frostbite.game_contracts`. With no node address set the pages open and say a step cannot be built.

## Behaviour worth knowing

- **Signing.** When a wallet on the deployment's `signingWallets` list (config; Xverse, UniSat and OYL today) is connected in the
  app's header, its address is offered as the one to sign with and the review has a Sign button: the wallet is asked to approve
  only the inputs nobody has signed. Otherwise the review shows the transaction to sign and a box for the signed result. Either
  way the platform checks what comes back is exactly what it built and showed; nothing else is sent. A wallet that declines
  leaves the step signable again.
- **Every transaction of a sent step is listed by id** (a template publish is a commit and a reveal), each linking to the block
  explorer in `GameAdminConfig.explorerTxUrl` (`{id}` where the id goes; per network in `configs/beta-chains.ts`), so staff can follow
  it by hand. A step sent without the network being seen to hold it says so, and on each refresh the platform looks the transaction
  up and, if the network does not have it, sends the same signed bytes again (the network gives the same id, and says so if it
  already holds them). A refusal is told as a failure with the network's reason.
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

## The platform fee and mints

The fee a player pays the platform on top of the network fee each time a milestone is minted is set here, per chain, and nowhere
else (`PlatformFeePanel` on `/admin/games`): the fee in satoshis and the treasury address are one form and are saved together. The
platform refuses an address the chain does not accept, a fee above `rewardsPolicy.maxPlatformFeeSats`, and a fee above zero but
below the dust limit of the address; 0 means no fee. A setting applies to the next claim a player starts; a claim already built
keeps the fee it showed. Every setting is kept with who made it and when. `MintsSection` (a game's page) and `MintFigures` (each
game's tile) read what the report in `@frostbite/game-claims` keeps: see that package for why it is cheap however many mints there are.

## Tests

`pnpm --filter @frostbite/feature-game-admin test:unit` (presenter, operations, client, registration, the panel, the contract card, the templates panel and
review against a fake API), `test:integration` (the operations over real PostgreSQL and the simulated chain: publish both templates, create
a game's contract, then administer it), `test:coverage`. Browser, accessibility,
keyboard, reduced-motion, responsive and visual behavior: `tests/e2e/tests/game-admin.spec.ts`.

## Ownership

The games platform owner.

## The page and the sheet

Each page is a signer line (who signs, and the fee speed as a chip), then sections (templates as tiles; the contract, claims and milestones; the activity log). Any action opens `StepSheet` the moment it is pressed: "preparing", then the step's review (lifecycle stages from the platform's record, the facts, the fee as its own card, and the sign button); a refusal or failure is shown in the sheet. `isStarting` marks only the button that was pressed as busy.
