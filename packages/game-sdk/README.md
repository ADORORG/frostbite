# @ador/game-sdk

How a game and the platform talk, and the tools to build, serve and test a game.

## Purpose

Every game is client-only: it makes no server calls. It runs in a sandboxed frame on the platform's domain and
asks the page around it, over `postMessage`, to remember things for the player. The platform page owns storage,
the account and (later) minting; the game owns only its rules and its drawing.

## Public API

- `./protocol`: the versioned message protocol (channel `ador-game`, version 1), as schemas. One `methods` table
  is the source of truth for names, parameters and results.
- `./client`: `createGameClient()` for a game: `ready`, `progress.load/save`, `milestones.list/unlock`,
  `player.info`. Failures surface as `GameHostError` with a stable code.
- `./host`: `createGameHost()` and `attachGameHost()` for the platform page. A message is handled only when its
  `event.source` is the game's frame (a sandboxed frame has no origin to check). Sizes and call rates are
  limited by `./policy`.
- `./local-backend`: keeps progress and milestones in the browser's storage, validated on read, and
  exports/replaces a dated snapshot of them.
- `./synced-backend`: the local backend with the account behind it. The browser stays the copy the game
  reads and writes; the account is reconciled once before the game's first read, then sent the whole local
  state after each change (one request at a time). A missing account (`signed-out`) ends syncing; a failed
  sync is `pending` and retried with the next change. `status()` is what the page may truthfully say.
- `./frame-headers`: the response headers (CSP `sandbox allow-scripts`, `connect-src 'none'`, …) the platform
  serves game files with.
- `./build`: `checkGameHtml`, `bundleGameScript`, `buildGame(s)`: turns `/games/<id>` into `public/play/<id>`.
- `./conformance`: runs a built game in jsdom against a simulated host, with storage and network blocked.

## Invariants

- A milestone claim carries a verification level; only `self-reported` exists. Nothing with money or privilege may
  depend on a self-reported milestone.
- The host re-validates every value in both directions and reports backend failures as `unavailable`.
- A game page may load only its own `main.js` and `styles.css`; `checkGameHtml` rejects anything else.

## Test commands

`pnpm test:unit`, `pnpm test:integration`, `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint`.

## Ownership

Platform games team. A protocol change is a version change: bump `protocolVersion` and keep the old one working
until every reviewed game has moved.
