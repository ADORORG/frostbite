# `@ador/feature-games`

The public games catalog and game detail pages. A game is a manifest (`@ador/shared/games`); this feature
only reads manifests and presents them.

## Public API

`createGamesFeature(games, chains)` returns the feature registration: `/games`, `/games/[slug]`, and a
"Games" navigation item. The games come from `configs/games.ts`, one line per game.

## Onboarding a game (the template)

1. Write the game's manifest with `defineGame` (see `docs/product/game-onboarding.md` for the template and
   every field).
2. Add it to the list in `configs/games.ts`: `defineGames([frostbite, yourGame])`.
3. Run the tests: the catalog, the detail page and the manifest checks pick it up with no other change.

The platform core is not edited to add a game.

## Invariants

- The pages show only what a manifest declares. A game with no play address is "Not playable yet", never
  live; capabilities and milestones are shown as declarations, with the statement that the platform does not
  yet grant capabilities, cannot claim milestones on chain, and cannot verify gameplay.
- A manifest that fails validation stops the platform from starting; it is not skipped.
- Identifiers are unique and are the page address. An address that cannot be an identifier is "Invalid
  route"; a valid one with no game is "Record not published".
- The feature performs no persistence, wallet, mint or on-chain operation.

## Dependencies and configuration

Depends on plugin contracts, `@ador/shared` (manifest schema, chain options), and shared UI. It reads no
environment value; where a game is played is supplied by the platform's configuration (`GAME_LAUNCHES`, applied
in `configs/games.ts`) before the manifests reach the feature.

## Verification

`typecheck`, `test:unit`, `test:integration`, `test:coverage`. Browser, accessibility, responsive,
reduced-motion and visual behavior is covered by Playwright.
