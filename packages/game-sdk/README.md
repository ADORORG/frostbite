# @ador/game-sdk

How a game and the platform talk, and the tools to build, serve and test a game.

## Purpose

Every game is client-only: it makes no server calls. It runs in a sandboxed frame on the platform's domain and
asks the page around it, over `postMessage`, to remember things for the player. The platform page owns storage,
the account and (later) minting; the game owns only its rules and its drawing.

## Public API

- `./protocol`: the versioned message protocol (channel `ador-game`, version 1), as schemas. One `methods` table
  is the source of truth for names, parameters and results.
- `./client`: `createGameClient()` for a game: `ready`, `progress.load/save`, `milestones.list/unlock/progress/counts`,
  `player.info`, `player.identity` (an opaque per-game id; `player.changed` when it changes on sign-in), `wallet.get` (the connected wallet's public address and network; needs the `wallet` capability), `wallet.connect` (asks the platform to open its wallet chooser; the same capability),
  `milestones.claim` (asks the platform to start a claim of an earned milestone; needs `milestone:claim`; `claim.changed` tells how it goes), `run.start` and `run.submit` (replay-verified runs: a platform seed, then one record per run; the `run:submit` capability), `capabilities.get`, `ui.toast`, and `on(event, handler)` for what the platform tells the game
  (`wallet.changed`, `lifecycle.changed`, `fullscreen.changed`). Failures surface as `GameHostError` with a stable
  code (including `permission_denied` for a capability the game did not declare).
- `./host`: `createGameHost()` for the platform page (`services` lend it a wallet, a way to open the wallet chooser and a place to show a toast;
  `push` and `emit` send events). `./attach`: `attachGameHost()` connects it to a frame. A message is handled only when its
  `event.source` is the game's frame (a sandboxed frame has no origin to check). Sizes and call rates are
  limited by `./policy`.
- `./local-backend`: keeps progress and milestones in the browser's storage, validated on read, and
  exports/replaces a dated snapshot of them.
- `./synced-backend`: the local backend with the account behind it. The browser stays the copy the game
  reads and writes; the account is reconciled once before the game's first read, then sent the whole local
  state after each change (one request at a time). A missing account (`signed-out`) ends syncing; a failed
  sync is `pending` and retried with the next change. `status()` is what the page may truthfully say.
- `./storage-shim`: `createPlatformStorage` gives a game written for `localStorage` a storage kept in memory,
  with the keys it names saved through `progress.save` (one save after a burst, a refused save retried with the
  next change). The page that owns the player's data stays the platform.
- `./cabinets`: `combineCabinets` / `cabinet(rules)` build one verifier from the rules of several cabinets; a record names its
  cabinet in `config.cabinet`, and an unknown or missing name is an `invalid-config` outcome.
- `./frame-headers`: the response headers (CSP `sandbox allow-scripts`, `connect-src 'none'`, …) the platform
  serves game files with.
- `./build`: `checkGameHtml`, `bundleGameScript`, `bundleGameStyles`, `buildGame(s)`: turns `/games/<id>` into
  `public/play/<id>`. `styles.css` is bundled with what it imports; fonts and images it names are published beside it
  under hashed names; a stylesheet that loads from another address fails the build.
- `./audio`: `createSound({ context: () => new AudioContext(), settings, onChange })` plays a game's music and effects from
  data, with no sound files: a `Track` (`./audio/tracks`: a tempo and voices of looping notes) and an `Effect`
  (`./audio/effects`: tones that glide between two pitches, or noise; `commonEffects` has click, start, good, win, lose). Browsers keep a page silent
  until the player acts, so nothing plays before `unlock()` is called from a press or key, and `state()` says
  `audible: false` until it is (and `available: false` where there is no audio). `pause()`/`resume()` follow the game,
  `followVisibility` silences a hidden tab, `setTempoScale` speeds the music with the game. `./audio/settings` holds the
  player's choices (music, effects, volume): the frame has no storage, so a game keeps `SoundSettings` beside its
  progress and reads it back with `parseSound`.
- The conformance runner lives in `@ador/test-kit` (`./simulated-game-host`, `./game-conformance`), since it is a
  test tool: `checkGameConformance({ folder, game })` checks a game folder the way the platform will play it.

## The local test page

`ador-game-dev <game-folder> [--game game.json] [--port 5173]` (and `pnpm game:dev <id>` inside this repository) opens a page
that frames the game in the same sandbox, serves its files with the headers the platform gives them, and builds it again on
every reload. Beside the game is a panel for the platform's side: sign the player in and out (the id changes from this browser's
to the account's and the game gets `player.changed`), connect a fake wallet and move it between networks (`wallet.changed`),
send `lifecycle.changed` (tab hidden) and `fullscreen.changed`, take a claim through its states one press at a time
(`claim.changed`), clear what the game saved, and read a log of every call, answer, refusal and event. `game.json` holds what the
page needs of the manifest: `{ "id", "capabilities", "milestones" }` (the same fields as the manifest's own). **Everything on the
panel is made up**: it shows how a game answers each case, not what the platform will decide (runs are not replayed, nothing is
minted, no failure or slow answer is injected). It needs `esbuild`, the same optional peer as the build.
`import { startDevHost } from "@ador/game-sdk/dev-host"` starts the same page from code, for a test.

## Installing it outside this repository

The package builds to plain JavaScript with declarations (`pnpm --filter @ador/game-sdk build:package`) and is packed
by `pnpm pack`, which runs that build first and swaps the source entries for the built ones (`publishConfig`).
It depends only on `zod`; `esbuild` is an optional peer, needed only for `./build`. Installing the packed file in an
empty project, type-checking against its declarations and running a conversation through it was done on
2026-10-13 (see `references/game-sdk-api-task-record.md`). It stays `private` and `UNLICENSED` until the owner
decides the package scope, licence and registry; publishing is then removing `private` and `pnpm publish`.

## Invariants

- A method or event that exists never changes shape (result schemas are strict, so a new field would break every
  game built on an older SDK). New abilities are new methods and events, found with `capabilities.get`.
- A method that needs a capability (`requiredCapability`) is refused with `permission_denied` unless the game's
  manifest declared it; an event that needs one (`requiredEventCapability`) is not sent. The wallet is given
  as a public address and a network name only.

- A milestone claim carries a verification level; only `self-reported` exists. Nothing with money or privilege may
  depend on a self-reported milestone.
- The host re-validates every value in both directions and reports backend failures as `unavailable`.
- A game page may load only its own `main.js` and `styles.css`; `checkGameHtml` rejects anything else.

## Test commands

`pnpm test:unit`, `pnpm test:integration`, `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint`.

## Ownership

Platform games team. A protocol change is a version change: bump `protocolVersion` and keep the old one working
until every reviewed game has moved.
