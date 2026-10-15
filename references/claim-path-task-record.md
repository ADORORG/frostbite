# The claim path for run records (G6c)

Branch `feat/claim-path`, stacked on `feat/ice-field-cabinet`; baseline `63d785a`. Plan: `docs/product/plan-g6c-claim-path.md`
(its opening lists where the build differs). Specification: `docs/product/run-record.md`. Task #62.

## What it is

A signed-in player can start a run of a game, play it from a seed the platform issued, submit its record once, and have the
milestones it earned held on their account as `replay-verified`. **The platform names no game**: a game is client-only, calls
only the SDK, publishes its own rules, and declares in its manifest which milestones those rules can decide.

## Decisions taken on the documented defaults (review at merge)

- **Run lifetime 24 hours; three open runs per player and game; signed-in players only; milestones earned once only**
  (typed policy: `maxOpenRuns`, `runLifetimeMs` in `@ador/game-runs`). A run left open stops counting when it expires.
- **A verifier is the game's own published file, pinned by digest in the manifest** and loaded by `@ador/game-verification`
  (`/node`, `/loader`, `/runner`). The registry is keyed by game id; the old code registry (`configs/verifiers.ts`) and the web
  app's and the repository root's dependencies on a game are gone.
- **First-party runner only.** `createInProcessRunner` runs the artifact in a `node:vm` context with a per-call time limit. It
  is **not a security boundary**; only `embedded` games (built from this repository) are loaded. Outside games stay
  self-reported until a sandboxed runner exists (task #65, ADR needed).
- **A verdict never grants a milestone the manifest does not declare replay-verifiable**, and a record for another seed or
  claiming such a milestone is rejected without a replay. Every submission that reaches a verdict spends the run.
- **A browser can never set the verified level**: a sync request that names it is read as self-reported; only
  `recordVerifiedMilestones`, in the transaction that settles a run, writes it. The merge keeps the stronger level with its own
  unlock time.
- **Refusals are answers** (`verified` / `rejected` / `refused`; `started` / `unavailable`); only a missing session is an error.
- **Capability `run:submit`** (already in the manifest) instead of a new `runs`; routes with ids in the body (this API has no
  path parameters). Both noted in the plan.
- **Request bodies are read under a 1 MiB ceiling before parsing**, on every route (`readJsonBody`).
- **The page says what was checked**: a "Replay-checked" badge and "Reported by the game" otherwise, and copy that the replay
  shows the run followed the rules, not that a person played it. The word "verified" is not used for a milestone.

## What was built

- **Schema and migrations:** `ador.game_runs` (`20261015175833_game_runs`) with checks for state, seed range, expiry, verdict
  coherence, digest shape and a 64 KB record; `game_milestone_unlocks.verification` accepts `replay-verified`
  (`20261015180946_milestone_replay_verified`).
- **`@ador/game-runs`** (new): `createGameRunsService` (start, submit), `createDrizzleGameRunRepository` (advisory lock per
  player and game for starts, row lock for submissions, a hook inside the settling transaction), policy, README.
- **`@ador/game-saves`:** `recordVerifiedMilestones`, `asReported`, level kept through the repository.
- **`@ador/game-verification`:** `runner.ts`, `loader.ts`, `node.ts`; the registry keyed by game id.
- **`@ador/shared`:** manifest `verification` (game and milestone), `runs.ts` contracts, level in the sync schema and merge.
- **`@ador/game-sdk`:** `run.start` / `run.submit` (protocol, host, client), policy (`runCallsPerMinute`, `runRecordMaxBytes`),
  `refreshVerified` and `adoptVerified` so the browser's copy takes back what the platform verified; `build` emits
  `verifier.js` and `verifier.json` for a game with `src/replay.ts`.
- **`@ador/feature-games`:** the two operations, the runs resolver (loads the verifiers once, logs those it cannot), the
  same-origin runs port, the labels in the dock and the milestone list. `configs/game-runs.ts`, rate limits.
- **FROST·BITE:** `src/replay.ts`, a manifest that pins the verifier and marks `first-win` and `first-glacier`
  replay-verifiable, and a cabinet that starts a run on the platform's seed when it can and submits at "End run".
- **Tests support:** `@ador/test-kit/adder-game`, a made-up second game the platform has never heard of, built and loaded by
  the same path in an integration test against real PostgreSQL (the principle "no platform change to onboard a game").
- **Docs:** `run-record.md`, `game-host-interface.md`, `game-onboarding.md`, the roadmap, READMEs, the ledger.

## Verification (run on this branch)

- **Mutation proof, by phase:** the run service and repository 22 guards (4 survived: the size boundary, the expired-state
  check, the digest binding, the hook for a rejected verdict; tests added, one redundant predicate removed; all killed on the
  re-run); milestones, routes and the body reader 23 (2 survived: the repository's level comparison and the route's use of the
  bounded reader; tests added); SDK, host, session 18 (3 survived: a redundant filter removed, the submit timeout, the page's
  refresh after a verdict; tests added); labels 9 (all killed); the FROST·BITE cabinet 15 (1 equivalent). The working tree was
  restored after each run.
- **Coverage (statements / branches / functions / lines):** `@ador/game-runs` 100/100/100/100; `@ador/game-saves`
  98.6/97.5/100/98.4; `@ador/game-verification` 100/96.4/100/100; `@ador/game-sdk` 98.3/96.8/98.5/98.3; `@ador/shared`
  98.9/99.1/97.9/98.9; `@ador/http` 100/100/100/100; `@ador/feature-games` 96.9/96.3/94.2/97.0; `@game/frostbite`
  98.5/93.8/100/100; `@game/sdk-explorer` 100/91.7/100/100.
- **Tests:** real PostgreSQL for the run repository (concurrent starts and submissions, expiry, rollback when the milestone write
  fails, every table check, cascade) and for the whole claim path with a second game (`apps/web/test/game-runs-flow`); the
  real browser plays FROST·BITE signed in and out (`tests/e2e/tests/ice-field.spec.ts`).
- `pnpm format:check`, `pnpm lint` (46 workspaces, repository policy), `pnpm typecheck`: passed. The full e2e result is at the
  end of this file.

## Found along the way

- Test files run in parallel and each migrated a fresh database, so two raced on `CREATE SCHEMA` the moment a second file
  did. The disposable-PostgreSQL runner now migrates once before any file starts.
- `protocol.ts` went over 300 lines; its constants and value schemas moved to `protocol-values.ts`, re-exported from the same
  path.
- A duplicate of the merge rule would have been needed in the SDK to bring verified milestones back; instead the local backend
  takes only the account's replay-verified records (`adoptVerified`), so the rule stays in one place.
- The first design returned HTTP errors for refusals; clients (and the SDK) need the reason, so refusals became answers.
- A run whose cabinet is closed without "End run" stays open until it expires; a player who does that three times has no run
  to start for a day and is told so (they play on a local seed).

## Not done (each is its own task)

Retention of rejected records (the plan's 90-day prune); the sandboxed runner and its ADR (#65); the dealer for hidden
information (#64); a real-time cabinet that can be replayed (#63); repeatable and target milestones; leaderboards (#54), which
must not accept the FROST·BITE ice field until the dealer exists; the deployed path to the games' files (`configs/game-runs.ts`
assumes the web app runs from its own folder).

## Full end-to-end run

381 passed, 119 skipped (project-specific), 0 failed, on a fresh production build. The first full run found 10 failures, all
consequences of FROST·BITE now declaring `run:submit` (pages and the explorer that said "does not ask the platform for
anything" or granted only `wallet`, and the game-detail screenshots); the expectations were updated and the four game-detail
baselines regenerated (no other baseline changed).
