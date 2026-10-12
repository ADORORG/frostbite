# G3 Game account sync

Branch `feat/game-account-sync`, from `dev` at `e61141b`. A signed-in player's progress and milestones are kept
on their account and follow them to another browser; a signed-out player's stay in the one browser.

## Decisions (owner away; defaults taken and logged)

- **Merge rule:** the newest save wins, a tie keeps the stored one, every milestone from both sides is kept with
  its earliest unlock time. One pure function, `mergeGameState` in `@ador/shared/games`, used by the server (the
  page only sends state), so it can be replaced in one place. "Highest score wins" was not chosen: it needs a game
  to define what better means.
- **A save dated beyond a 5-minute clock skew is ignored, not clamped.** Found by e2e: clamping to "now" moved the
  saved time forward on every replay (not idempotent) and let a wrong clock keep overwriting newer saves.
- **No idempotency key.** The sync is naturally idempotent (a replay changes nothing), so a retry after a lost
  answer is safe.
- Only `self-reported` exists, in the column check and in the contract.

## What was built

- `@ador/shared/games/sync`: contracts, route `POST /api/v1/games/sync` (`syncGameState`), merge rule.
- `@ador/database`: `game_saves`, `game_milestone_unlocks` + migration `20261012063250_game_saves`.
- `@ador/game-saves` (new): service (game listed, milestone declared, size, merge) and the PostgreSQL adapter
  (rows locked `FOR UPDATE`, JSON `null` kept as a save).
- `@ador/feature-games`: the authenticated operation, lazy runtime, rate limit `syncGameState` 120/min, the
  client account port (401 = signed out, other failures = pending, 5 s timeout), a status line that says only
  what is true (`account` / `local` / `pending`).
- `@ador/game-sdk`: local backend dates saves and exports/replaces a snapshot; `createSyncedBackend` reconciles
  once before the game's first read, then sends the whole local state after each change, one request at a time.

## Bugs found by the new tests

1. Clamping a future save broke idempotency (e2e) -> rule changed, tests added.
2. The host session restarted when the function that finds the account changed identity (seen in the production
   bundle only: a default parameter compiled to a new function per render) -> the hook no longer depends on its
   identity (`useEffectEvent`); regression test renders with a new function and asserts one start.
3. The concurrency test did not prove the lock (mutant survived) -> replaced by a test that holds the rows from
   another transaction and asserts the sync waits.
4. My own spec shared one account across the four viewport projects -> desktop only.

## Gates (all run on this tree)

format:check, env:check, lint (42 tasks + clippy + repository policy, 42 workspaces), typecheck (42),
migration check ("No schema changes"), 300-line audit (largest 294), unit/integration for shared (458), game-sdk
(103), game-saves (16, real PostgreSQL), feature-games (44), database schema; coverage: game-saves 100/100/100/100,
game-sdk 99.66/97.58/100/100, feature-games 97.02/96.2/95.45/97.87, shared 99.05/98.98/98.43/99; e2e full run:
315 passed, 3 failed (bug 4, fixed), then the new spec alone: 21 passed, 3 skipped by design. Game-host snapshots
regenerated (only the progress sentence changed).

## Mutation proofs

28 mutants, all killed (merge order/tie/skew/boundary/milestone time/dropped milestones/future unlock; service
game/milestone/limit/bytes; repository lock/JSON null/earlier unlock/write; synced backend read-before-reconcile,
signed-out, resend, apply, status, overlap; local undated; port 401/timeout; operation auth/mapping; session
restart). One survived at first (row lock) and led to bug 3's fix.

## Not done / follow-ups

- `player.info` reports `signedIn: false` until the first sync answers (the game may ask earlier).
- Milestone states in the UI (G4); anything with value stays blocked on verification (G6/G7).
- The in-page copy has no sign-in link; the platform has no sign-in route for players yet.
- game-player integration test file is 294 lines: split before it grows.
