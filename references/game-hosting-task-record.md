# W8-03 Verify subdomain-style and domain-path-style game hosting

Branch `feat/w8-03-game-hosting`, stacked on `feat/w8-02-frostbite-launch`.

## What was built

- `tests/e2e/src/game-hosting.ts`: `serveGame` hosts a game's files with a host to itself, or only under a base
  path (every other address is a 404, as on a shared games host), reading nothing outside the game's folder;
  `auditGameDirectory` screens a folder for root addresses and other hosts it loads from.
- A fixture game that names every file relative (`fixtures/hosted-game`) and one that names them from the root
  (`fixtures/broken-game`). Browser spec: the first works in both styles with identical bytes; the second works
  with a host to itself and fails under a base path (its two root files are 404).
- `pnpm --filter @repo/e2e audit:game -- <folder>` for real games.
- A new rule: a game is never played on the platform's own origin, with or without a base path
  (`GAME_LAUNCHES` refuses it). A game is code the platform did not write and must not run beside a signed-in
  player's session (D23). Platform-side links for both styles were already proven in W8-02 tests.

## Verification of the first game (FROST·BITE, legacy prototype in `frostbite-game/`)

The audit found:

- **One root address:** `alkanes.jsx:211`, `fetch("/api/run")` (the house-signer call, live mode only; the
  default mode is simulated). Under a base path it would reach the games host's root, and a host with a game
  to itself has no such API. It needs a configurable API base (migration task GP-09).
- **Loads from other hosts:** `unpkg.com` (React 18, ReactDOM and the in-browser Babel compiler, with integrity
  hashes), `fonts.googleapis.com` and `fonts.gstatic.com`, `api.alkanode.com` and `kirby.alkanode.com`.
- Compiling JSX in the browser with Babel needs a script-evaluation allowance in a content-security policy, which
  a strict policy for games would not grant. The migration should precompile the game and serve React and fonts
  itself.
- Everything else is relative, so the static files work in both styles; they were not run end to end in a browser
  here because the page needs those external hosts (no network was used).

Conclusion: the platform side supports both styles from one build; FROST·BITE as it stands is hosted in
either style only for its simulated mode, and needs the migration (GP-09) before live play.

## Evidence

- 10 integration tests for the host and audit; 3 browser tests (both styles and the failing fixture).
- Mutation proofs (10 run): base path enforcement, traversal guard, bare base path, bad encoding, css and
  script address patterns, de-duplication, external-address check, request log: all killed. One mutant (looser
  prefix match) is equivalent: a loose match still finds no file, so it is not a behavior change.
- Config rule: tested for both base-path and no-base-path cases and for sibling host / other port being allowed.

## Not done

Running the real game in a browser against both hosts (needs the migration and offline copies of its
dependencies), a content-security policy for games (W8-06), and the host protocol (GP-02).
Three-pass convergence loop not run.
