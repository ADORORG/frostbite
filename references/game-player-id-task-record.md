# Player id for games (SDK-1b)

Branch `feat/game-player-id`, on top of `feat/game-sdk-api-v2`. Owner decisions (2026-10-13, surveys): an opaque
per-game player id, derived/kept on the server; a local id replaced on sign-in with the game told by an event; no
name or avatar for now.

## Decisions taken on the documented defaults (review at merge)

- **A stored random id, not a derived one.** A keyed hash of the account and game would need a new server secret
  (environment key, parity files, rotation). A random `player_id` column on the player's save row needs none, cannot
  be worked out by anyone who learns an account id, and is stable for the life of the row. Cost: one migration.
- **No capability needed.** The id is random and says nothing about a person, unlike the wallet address.
- **The id waits for the first account answer**, like the first read does, so a signed-in player's game is never
  shown an id that is about to change. If the account cannot be reached the game starts with the local id and is
  told when the account's arrives. `player.changed` may repeat the current id; the guide says to compare.
- **Additive:** `player.identity` and `player.changed` are new; no existing shape changed.

## What was built

- Database: `game_saves.player_id` (uuid, not null, random default, unique); migration `game_player_id`. Existing
  rows each get their own random id when the column is added.
- Shared: the sync response is the state plus `playerId` (strict).
- `@ador/game-saves`: the repository and service return `{ playerId, state }`.
- Sync route: answers with the id; the page's account port hands it over apart from the state.
- SDK: `player.identity`, `player.changed`, `playerIdentitySchema`; backend `identity()`; the local backend keeps a
  random id per browser and game (a corrupt stored value is replaced); the synced backend answers with the account's
  id after the first reconcile and calls `onIdentity` once when it changes.
- Page: tells the game `player.changed` when sign-in replaces the id. SDK explorer: a `player.identity` button.
- Docs: roadmap, onboarding guide, interface Amendment 3, READMEs.

## Evidence

- Unit and integration tests: game-sdk, game-saves (real PostgreSQL: one id per player and game, different per
  player and game), database schema, feature-games (account port rejects an answer without a valid id; a game that
  began on the local id is told when the account's replaces it), explorer.
- 12 mutants of the guards (id validation, persistence, change announcement, announce-once, waiting for the
  account, preference for the account's id, ready guard, id returned by the service, id stable in the repository,
  id in the route answer, event reaching the game, id kept out of the saved state): all killed; one survivor (announce
  on every sync) drove a new test, then died.
- Browser (real frame, real server and database): a signed-out id stays across a reload and is kept under the
  game's own key; a signed-in player gets the same id in two browsers, equal to what the server holds; another
  player and another game get different ids.

- Gates: format, lint (45 tasks, repository policy), typecheck (45). Coverage: game-sdk 99.5/97.89/100/99.72,
  game-saves 96.96/94.44/100/96.55, feature-games 98.63/95.65/97.84/98.98, shared 98.91/99/97.69/98.85, test-kit
  98.93/96.62/97.71/99.24, database 96.62/95.83/94.79/96.53; explorer and sample game thresholds met. Web unit 54 and
  integration 46 pass. Full e2e: 369 passed, 59 skipped by design, 0 failed.

## Known gaps

- The migration was applied to an empty test database only; adding a volatile default to a populated table is
  standard PostgreSQL behaviour (each row gets its own value) but was not run against real rows here.
- Name and avatar remain unbuilt (no profile). The formal three-pass review was not run.
