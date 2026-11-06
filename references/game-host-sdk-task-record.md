# Game host, step 1: SDK, isolated frame and sample game

Branch `feat/game-host-sdk`. Follows the draft `docs/product/game-host-interface.md` (branch
`docs/game-host-interface`). Covers part of GP-02, GP-03 and GP-04. Minting, account sync and the milestone
verification levels beyond `self-reported` are not built.

## What was built

- **`@frostbite/game-sdk`**: protocol v1 (`frostbite-game` channel; ready, progress load/save, milestones list/unlock,
  player info) as schemas with one `methods` table; `createGameClient` (game side); `createGameHost` and
  `attachGameHost` (page side, accepts a message only from the frame's own window); `createLocalBackend`
  (browser storage, validated on read); policy limits (64 KB progress, 60 saves/min, 60 unlocks/min); frame
  response headers; build helpers (`checkGameHtml`, `bundleGameScript`, `buildGames`); a jsdom conformance runner.
- **`games/sample-game`** (Tap Tower): the template. Rules in `src/game.ts`, page in `src/main.ts`, one script,
  one stylesheet. A probe button tries network, storage and cookies and reports the result.
- **Platform**: a new `embedded` launch mode (`/play/<id>/index.html`); `GamePlayer` (sandbox `allow-scripts`
  frame, started only after the host is listening, milestones panel labelled as self-reported);
  `apps/web/scripts/build-games.ts` (pre-build and pre-dev) into the git-ignored `public/play`; response headers
  for `/play/*` from `next.config.ts` (CSP `sandbox allow-scripts`, `connect-src 'none'`, `frame-ancestors 'self'`);
  `/play` excluded from the page proxy so the two policies do not combine; page CSP `frame-src 'self'`.
- The sample game is registered only when `APP_ENV` is `local` or `test` (`developmentGamesEnabled`).
- Repository policy: `apps/web/public/play` is generated output and skipped by the size check; the web ESLint
  config ignores it; turbo's web build now lists `public/play/**` as output and `games/**` as input so a cached
  build still restores the games.

## Findings

- The first version of `GamePlayer` had no `ref` on the frame, so the host never attached. The jsdom test caught it.
- Starting the game from the server's markup races hydration: the game's first `ready` can arrive before the
  host listens and is lost. The page now sets the frame's address only after attaching (test asserts both the
  markup has no `src` and the host answers at the moment the game starts).
- Static files in `public` have no directory index, so the entry is `/play/<id>/index.html`.
- Bundling the SDK pulled in zod (770 KB, 19k lines); bundles are now minified.
- A real browser shows the isolation: fetch, localStorage and cookie are all blocked inside the frame.

## Evidence

- Unit and integration tests in game-sdk (89), sample-game (15), features/games (23), shared, config, web,
  repository-policy. Playwright `game-host.spec.ts`: connect, tap, unlock, reload and persist; the probe; the
  headers; accessibility and visual baselines on four viewports.
- Mutation proofs: see the section below.

## Mutation proofs

Each change below was made by hand, the named tests run, and the source restored. All eight were caught.

| Break                                           | Caught by                          |
| ----------------------------------------------- | ---------------------------------- |
| Host accepts a message from any window          | `attach.unit.test.ts`              |
| Game CSP allows `connect-src 'self'`            | `frame-headers.unit.test.ts`       |
| Game CSP sandbox gains `allow-same-origin`      | `frame-headers.unit.test.ts`       |
| `checkGameHtml` stops checking remote addresses | `build.integration.test.ts`        |
| Preview counts as a development environment     | `game-launches.unit.test.ts`       |
| Frame sandbox gains `allow-same-origin`         | `pages.integration.test.tsx`       |
| Frame is never started                          | `game-player.integration.test.tsx` |
| Catalog ignores the embedded mode               | `catalog.unit.test.ts`             |

## Gates

Format, env check, lint (with repository policy: 41 workspaces), typecheck: green. Coverage (all workspaces, merged line and
branch above 90%): green. Full Playwright suite: 294 passed on four viewports.
