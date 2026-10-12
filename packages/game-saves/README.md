# `@ador/game-saves`

A signed-in player's saved state for a game: the latest save and the milestones they earned. It owns the
checks and the persistence; the HTTP route belongs to `@ador/feature-games`, and the merge rule belongs to
`@ador/shared/games` (`mergeGameState`), so the page and the server cannot disagree about it.

## Public API

- `createGameSyncService({ clock, games, maxProgressBytes, repository })`: `sync(userId, { gameId, state })`
  merges the state a browser sends into the account and returns the merged state. Every outcome is a value:
  `synced`, `unknown-game`, `unknown-milestone`, `too-large`.
- `createDrizzleGameSyncRepository(database)`: the PostgreSQL adapter for `GameSyncRepository`.

## Invariants

- The game must be one the platform lists, and every milestone must be one that game declares: the
  service checks, whatever the page sent. The owner is the session's user, never a field of a request.
- Every milestone ever stored is kept (a sync never removes one), with the earliest unlock time seen.
  Nothing is `verified`: the only level is `self-reported`, in the column and in the contract, and nothing
  with money or privilege may depend on it (ADR-018).
- The newest save wins; a tie keeps the stored one; a save dated beyond the clock skew is ignored. Replaying
  a sync changes nothing, so a retry after a lost answer is safe and no idempotency key is needed.
- One sync per player and game at a time: the rows are locked (`FOR UPDATE`) for the transaction, so two
  devices syncing at once cannot lose a save or a milestone.
- A save is at most `maxProgressBytes` of JSON text (the host policy's limit, 64 KB by default). A saved JSON
  `null` is stored as a save, not as no save.
- Rows are removed with the player (`ON DELETE CASCADE`).

## Configuration

None of its own. The games and their milestones, and the size limit, are supplied by the caller.

## Tests

`pnpm --filter @ador/game-saves test:unit` (the service), `test:integration` (the adapter on real
PostgreSQL, including two devices syncing at once), `test:coverage`.

## Ownership

The games platform owner. A new verification level or a different merge rule is a migration and a change in
`@ador/shared/games`, with an ADR-018 update.
