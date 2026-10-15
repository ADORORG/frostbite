# `@ador/game-runs`

Server-issued runs for replay-verified milestones. A signed-in player asks for a run, the platform gives it a
seed, and the game submits the record of that run once. The platform replays it and stores the verdict. It
holds no game logic: the game is only a manifest entry (its verifier digest and the milestones it declares
replay-verifiable), supplied by the caller.

## Public API

- `createGameRunsService({ clock, game, newId, newSeed, policy, repository, verify })`
  - `start(userId, gameId)`: `ok` with `{ runId, seed, expiresAt }`, `unavailable` (the platform has no verifier
    for the game), or `too-many-open-runs`.
  - `submit(userId, gameId, runId, record)`: `ok` with the verdict, or a refusal: `not-found`,
    `already-submitted`, `expired`, `stale`.
- `createDrizzleGameRunRepository(database, { clock, onVerified? })`: the PostgreSQL adapter for
  `GameRunRepository`. `onVerified(transaction, run, earned, at)` runs inside the settling transaction (the
  caller writes the player's milestones there).
- `resolveGameRunPolicy(overrides?)`: `maxOpenRuns` (1-20, default 3), `runLifetimeMs` (1 minute to 7 days,
  default 24 hours).

## Invariants

- A run is settled once. Submitting takes a row lock (`FOR UPDATE`) on the run, so concurrent submissions
  settle exactly one; the rest see `already-submitted`.
- Every submission that reaches a verdict spends the run, including a rejected one. A record for another seed
  is rejected without a replay. A claim the manifest does not declare replay-verifiable is rejected without a
  replay, and a verdict never grants a milestone the manifest does not declare.
- A run is bound to the verifier digest at issue. If the game's rules change, the run is `stale` and spent.
- An overdue run is `expired` when seen, and does not count against the open-run limit. Starts are serialised
  per player and game by an advisory lock, so the limit holds under concurrency.
- The milestone write and the verdict commit together; if the write fails, the run stays open.
- The canonical record text is kept up to 64 KB (`game_runs_record_bounded`); a larger record is not kept but
  its digest is. Another player's run, another game's run and an unknown run are all `not-found`.
- Runs are removed with the player (`ON DELETE CASCADE`). Pruning old rejected records is not implemented yet.

## Configuration

None of its own. The policy, clock, ids, seeds and the `verify` function are supplied by the caller.

## Tests

`pnpm --filter @ador/game-runs test:unit` (the service against an in-memory repository),
`test:integration` (the adapter and the table's checks on real PostgreSQL, including concurrent starts and
submissions), `test:coverage` (100% of statements, branches, functions and lines).

## Ownership

The games platform owner. A change to the table is a migration.
