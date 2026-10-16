# `@ador/game-admin`

The steps staff take to administer a game's rewards contract: define a milestone (with its drawing) and pause or resume claims.
Build the transaction, keep what staff were shown and signed, send it, and follow it until the chain agrees. Decisions: ADR-018
Amendment 3 (no platform key; staff sign each step by hand; any admin may pause and resume, logged) and its D19/D22 note.
Works through the chain-neutral ports (`@ador/chain`), tested on the simulated chain; the `bitcoin-alkanes` adapter builds the
same steps (`packages/chain/src/bitcoin-alkanes/admin`).

## Public API

`createGameAdminService(dependencies)` returns:

- `start({ staffId, gameId, action, wallet, authTokenOutput? })`: builds the transaction and stores the step as
  `awaiting_signature` with the summary to show. Asking again for a step in progress returns it (`resumed: true`). Refuses with
  `not-administered`, `unavailable`, `wrong-chain`, `bad-drawing` (+reason), `already-defined`, `could-not-build` (+reason).
- `submitSigned({ staffId, stepId, signed })`: checks what was signed against what was built (`verifySigned`), keeps it with who
  sent it, broadcasts once. The same signed step twice changes nothing.
- `refresh(stepId)`: looks at the chain once and moves the step as far as the evidence allows; safe to call as often as wanted.
- `list(gameId)`: the log of a game's steps, oldest first.

`createDrizzleGameAdminRepository(database, { clock })` stores steps in `ador.game_admin_steps`.

## Invariants

- The log is the audit trail: a step records who built it and who sent it, and rows are never deleted (a removed account leaves
  `null`). Who may use the service is the caller's check (the web route requires the admin capability).
- At most one step per game, operation and milestone is in progress; pausing and resuming are one operation, so only one change of
  the pause state is in flight. A milestone whose definition completed cannot be defined again (the contract refuses it too).
- A step is complete when the network confirms it; the observer says confirmed only once the indexer has run the call.
- The lifecycle (`canMove`, `afterObservation`, `afterBroadcast`, `moveTo`) and the stored-row mapping are shared with
  `@ador/game-claims` through `@ador/shared/chain`; the table's columns and checks through `@ador/database`
  (`tracked-transaction.ts`).

## Not here

Publishing a template and creating a game (they happen before a game has a contract to administer); the routes and page
(`features/games`); the signer.

## Tests

`pnpm --filter @ador/game-admin test:integration` (the service end to end on the simulated chain against real PostgreSQL:
lifecycle, in-progress reuse, refusals, rejection, revert, expiry, concurrency, the table's constraints), `test:coverage`.
Mutation proof: `references/game-admin-task-record.md`.

## Ownership

The games platform owner.
