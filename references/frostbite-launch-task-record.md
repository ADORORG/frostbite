# W8-02 Register Frostbite with configurable play address, base path, return address and network

Branch `feat/w8-02-frostbite-launch`, stacked on `feat/w8-01-games-catalog`.

## What was built

- The manifest's launch is now `{ mode: "external", url, basePath, returnUrl }`: `url` is a host only (no path,
  query or trailing slash), `basePath` is where the game lives under it (blank = the whole host, the subdomain
  style; `/play/frostbite` = a path of a domain), `returnUrl` is where the game sends the player back.
  `gamePlayAddress` joins them. Settings are applied by `applyGameLaunchSettings`; a setting naming a game that
  is not registered stops the platform from starting.
- One optional environment key, `GAME_LAUNCHES` (JSON keyed by game id: url, basePath, returnUrl, network),
  parsed by `parseGameLaunchEnvironment` in `@repo/config/env`. Adding a game never adds a key. Added to the typed
  inventory and all seven templates (and the local `apps/web/.env.local`, which the parity check requires).
- Rules: preview and production need an HTTPS host; a return address must be on `PUBLIC_BASE_URL`'s origin (so a
  player is never sent to a place an attacker can name); the network must be a configured chain
  (`configs/games.ts`); bad JSON or values refuse to start.
- FROST·BITE stays registered with no host until a deployment sets one; the page shows the host a game opens at.
- Docs: `game-onboarding.md` (settings section) and the preview checklist.

## Evidence

- Unit tests: manifest and launch (77), env parsing (18), the platform's game list under each setting (7),
  catalog and pages. Environment template parity passes (`pnpm env:check`).
- Mutation proofs, all killed: 14 (origin shape, base path, play address, unknown setting, network, return address,
  HTTPS rule, return origin, blank value, bad JSON, chain check, settings applied, catalog and host display).
- The e2e baselines are unchanged: the e2e deployment sets no `GAME_LAUNCHES`, so FROST·BITE is still shown as
  not playable. A configured game is covered by the apps/web and catalog tests, not a browser.

## Not done

W8-03 verifies the two hosting styles against a real host and the legacy game's own base-path behaviour. The
return address is stored and validated; nothing sends a player back yet (the host protocol is GP-02).
The three-pass convergence loop was not run.
