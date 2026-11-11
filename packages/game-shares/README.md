# `@frostbite/game-shares`

What a signed-in player chose to share, and the link that shows it: a milestone they hold, the case of milestones they have minted,
or a score. The link is `/s/<id>` (`sharePath` in `@frostbite/shared/games`); the public page, its preview picture and the HTTP routes
belong to `@frostbite/feature-games` and the web app, which read through this package so a page can only show what was checked here.

## Public API

- `createGameSharesService({ clock, games, level, newId, repository })`: `create(userId, request)` checks the request and returns the
  link (`shared`) or a refusal (`unknown-game`, `unknown-milestone`, `not-earned`). `get(id)` is the public view of a live share, or
  null. `revoke(userId, id)` ends the player's own share.
- `createDrizzleGameShareRepository(database)`: the PostgreSQL adapter for `GameShareRepository`.

## Invariants

- The owner is the session's user, never a field of a request. The public view carries no user, name, wallet or email.
- A milestone share is made only for a milestone the game declares and the account holds. Its level (`replay-verified` or
  `self-reported`) is read from the account, not from the request (the same two levels `@frostbite/game-saves` keeps).
- A score is always `self-reported`: no replay verifier returns a score, so the platform cannot call one verified. The table refuses a
  verified score, a negative one and a case that names a game.
- A share is a snapshot: the score on a card never changes under a link already posted.
- One live share per player and thing (partial unique indexes). Asking again returns the same link, also when asks arrive together.
- A revoked share answers as if it never existed; sharing the same thing again makes a new link. Shares go with their player
  (`ON DELETE CASCADE`).
- Referral attribution, when it is decided (REF-1), reads `user_id` of the share a visitor came through; nothing is added to the link.

## Configuration

None of its own. The listed games and the milestones each declares are the map the sync service is given.

## Tests

`pnpm --filter @frostbite/game-shares test:unit` (the rules), `test:integration` (the adapter on real PostgreSQL, including the
constraints and concurrent asks), `test:coverage` (both).

## Ownership

Platform games domain.
