# `@ador/game-admin`

The steps staff take on the platform's rewards contracts: publish a template, create a game's contract, define a milestone (with its
drawing), and pause or resume claims. Build the transaction, keep what staff were shown and signed, send it, and follow it until the
chain agrees, and record what it made. Decisions: ADR-018
Amendment 3 (no platform key; staff sign each step by hand; any admin may pause and resume, logged) and its D19/D22 note.
Works through the chain-neutral ports (`@ador/chain`), tested on the simulated chain; the `bitcoin-alkanes` adapter builds the
same steps (`packages/chain/src/bitcoin-alkanes/admin`).

## Public API

`createGameAdminService(dependencies)` returns:

- `start({ staffId, gameId, action, wallet, authTokenOutput? })`: builds the transaction and stores the step as
  `awaiting_signature` with the summary to show. Asking again for a step in progress returns it (`resumed: true`). Refuses with
  `not-administered`, `unavailable`, `wrong-chain`, `bad-drawing` (+reason), `already-defined`, `could-not-build` (+reason), and for
  the two new steps `unknown-template`, `already-published`, `address-taken`, `template-not-published`, `already-created`.
  Actions: `publish-template` (the address staff chose, for no game), `deploy` (the drawing size the new contract accepts),
  `define-milestone`, `set-claims-paused`.
- `submitSigned({ staffId, stepId, signed })`: checks what was signed against what was built (`verifySigned`), keeps it with who
  sent it, broadcasts once. The same signed step twice changes nothing.
- `refresh(stepId)`: looks at the chain once and moves the step as far as the evidence allows; safe to call as often as wanted.
- `list(gameId | null)`: the log of a game's steps (null: the steps that published templates), oldest first.
- `status(gameId)`: whether the game has its contract (and the drawing size it accepts) and whether both templates it is made
  from are published; null for a game the service does not administer.
- `templates()`: the templates published on the rewards chain, and where.

`createDrizzleGameAdminRepository(database, { clock })` stores steps in `ador.game_admin_steps`. What completed steps made is read
through the `ContractStore` of `@ador/database/game-contracts` (`ador.published_templates`, `ador.game_contracts`), which the
repository writes to in the same transaction that completes the step.

## Invariants

- The log is the audit trail: a step records who built it and who sent it, and rows are never deleted (a removed account leaves
  `null`). Who may use the service is the caller's check (the web route requires the admin capability).
- At most one step per game, operation and milestone is in progress; pausing and resuming are one operation, so only one change of
  the pause state is in flight. A milestone whose definition completed cannot be defined again (the contract refuses it too).
- A step is complete when the network confirms it; the observer says confirmed only once the indexer has run the call.
- **What a step made is recorded with it or not at all.** Completing a publication records the template at the address staff chose;
  completing a creation records the contract the chain reported (the first contract its trace created), in the same transaction. A
  creation the chain says nothing about fails to index and records nothing, until staff enter the address (`recordCreated`): it is
  accepted only if a contract is there with the game template's code hash and the address is free, then recorded and the step
  completed in one transaction, with who entered it (`recorded_by`). Addresses are never configuration, and a recorded
  address never changes (the tables refuse a second record for a game, a template, or an address).
- A step is about one game, or (publishing a template) about none; the table's checks keep each operation's subject and contract
  coherent (`subject_coherent`, `contract_coherent`).
- The lifecycle (`canMove`, `afterObservation`, `afterBroadcast`, `moveTo`) and the stored-row mapping are shared with
  `@ador/game-claims` through `@ador/shared/chain`; the table's columns and checks through `@ador/database`
  (`tracked-transaction.ts`).

## Not here

The routes and page (`features/game-admin`); the signer; reading a creation's address from a trace (the adapter's observer does,
`created` on the observation).

## Tests

`pnpm --filter @ador/game-admin test:integration` (the service end to end on the simulated chain against real PostgreSQL:
lifecycle, in-progress reuse, refusals, rejection, revert, expiry, concurrency, the table's constraints), `test:coverage`.
Mutation proof: `references/game-admin-task-record.md`.

## Ownership

The games platform owner.
