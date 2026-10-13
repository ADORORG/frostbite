# `@ador/feature-games`

The public games catalog and game detail pages, the frame that plays an embedded game, and the one API route
that saves a signed-in player's progress and milestones. A game is a manifest (`@ador/shared/games`); the host
page connects it to the platform through `@ador/game-sdk`.

## Public API

`createGamesFeature(games, chains)` returns the feature registration: `/games`, `/games/[slug]`, and a
"Games" navigation item, and `POST /api/v1/games/sync` (authenticated; rate limited as `syncGameState`; the
service is `@ador/game-saves`). The games come from `configs/games.ts`, one line per game.

## Onboarding a game (the template)

1. Copy `games/sample-game` and write the game (see `docs/product/game-onboarding.md`, the full guide).
2. Write its manifest with `defineGame` (`launch: { mode: "embedded" }`) in `configs/games/`.
3. Add it to the list in `configs/games.ts`: `defineGames([frostbite, yourGame])`.
4. Run the tests: the catalog, the detail page and the manifest checks pick it up with no other change.

The platform core is not edited to add a game.

## Invariants

- The pages show only what a manifest declares. A game with no play address is "Not playable yet", never
  live. Each capability a game declares is marked "Available" only when the host answers it and the platform plays
  the game itself (today: `wallet`); every other one is marked "Not available yet" and is a declaration only.
  Milestones are shown with the statement that the platform cannot claim them on chain or verify gameplay.
- A manifest that fails validation stops the platform from starting; it is not skipped.
- Identifiers are unique and are the page address. An address that cannot be an identifier is "Invalid
  route"; a valid one with no game is "Record not published".
- The feature performs no mint or on-chain operation, and signs nothing. For a game that declared the `wallet`
  capability it mounts the wallet connection on the game's page and passes the game only the connected wallet's
  public address and network (`wallet-game-player.tsx`); a game that did not declare it gets no wallet provider. The only persistence is the sync route (which also returns the player's random per-game id, kept on the save row), which
  stores the player's own state for a listed game and its declared milestones, never anything a request names
  for another player. Milestones are labelled self-reported.

## Dependencies and configuration

Depends on plugin contracts, `@ador/shared` (manifest schema, chain options), `@ador/wallet` (the wallet
connection, mounted only for a game that declared `wallet`) and shared UI. `createGamesFeature` takes the wallet
configuration (`GameWalletConfig`: network and the connection page's address) from `configs/wallet.ts`. It reads no
environment value; where a game is played is supplied by the platform's configuration (`GAME_LAUNCHES`, applied
in `configs/games.ts`) before the manifests reach the feature.

## Verification

`typecheck`, `test:unit`, `test:integration`, `test:coverage`. Browser, accessibility, responsive,
reduced-motion and visual behavior is covered by Playwright.
