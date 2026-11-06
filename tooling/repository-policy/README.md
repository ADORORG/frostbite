# `@repo/repository-policy`

Executable repository invariants for The Well. The package validates workspace test scripts,
handwritten source-file limits, architectural import boundaries, and decision-gate documentation.
It also combines workspace coverage summaries and LCOV records into a root report while enforcing
greater-than-90% line and branch coverage per workspace and in aggregate.

Run `pnpm repository:check` for static policies, `pnpm decision:check` for the decision catalog,
and `pnpm repository:coverage` after workspace coverage reports exist. Root and CI commands invoke
these gates automatically.

The import-boundary policy also keeps chain-family code and vendor SDKs (`@frostbite/chain/bitcoin`,
`/bitcoin-alkanes`, `/alkanes`, `bitcoinjs-lib`, `@alkanes/*`, `@omnisat/*`) inside `packages/chain/`,
`providers/chain/`, `packages/wallet/`, and conformance tests; `packages/auth/` is a recorded exception
until sign-in moves to the neutral address codec (ADR-017). Everything else uses the neutral ports.

## Every policy is wired

`src/check.ts` only prints; the list of static policies `pnpm repository:check` runs is `collectViolations` in `src/collect-violations.ts`. Its test
builds a clean fixture repository and breaks one policy at a time, so a policy that is dropped from the list (and so no longer enforced) fails a test.
A new policy goes in that list and gets a breakage in `test/collect-violations.unit.test.ts`.

## Sentences are written once

`src/sentence-policy.ts` fails `repository:check` when a user-facing sentence (a capitalised double-quoted literal of five words or more that
ends in `.`, `?` or `!`) is written in more than one place in production source (`features/*/src`, `packages/*/src`, `apps/web/src`). Write it
once and share it. Duplicates that existed when the check was added are in `sentence-baseline.json`; the check refuses a baseline that allows
more copies than there are, so it can only shrink. After removing a duplicate, run `pnpm --filter @repo/repository-policy update-sentence-baseline`.

## Coverage reaches the merge job

`src/workflow-policy.ts` fails `repository:check` when a workspace's `coverage` folder is not listed under the `path:` of an upload step in
`.github/workflows/ci.yml`. CI passes the reports from the test jobs to the merge job as artifacts, so a workspace that is not listed
fails the merged coverage check minutes into a run, although every test passed (this happened when `configs` became a workspace).

## Running CI's jobs on this machine

`pnpm ci:local` runs the steps of the jobs in `.github/workflows/ci.yml` (read from the file, so it cannot drift from CI) the way the runner does: `CI=true`, the
browsers installed by the workflow's own step into `.ci-local/browsers` (so a browser your machine happens to have cannot hide a missing install),
and sharded jobs once per shard. Default jobs: `static`, `typecheck`, `tests`, `game-simulations`, `coverage-merge`, `e2e`; name others with
`--job <id>` (repeatable; `contracts` needs Rust). A step's output is in `.ci-local/logs`. `sudo` steps (system packages) are skipped and
`--with-deps` is dropped: install those yourself. It cannot reproduce the runner's fonts or a different operating system, so a pixel-exact
expectation can still pass here and fail there: guards compare with a tolerance for that reason.

### What a green local run does not cover

`pnpm ci:local` does not run `contracts` and `contracts-harness` (they need Rust), `image` (a Docker build, pull requests only) or `publish` (a push to
`main`/`dev`, once `static`, `typecheck`, `coverage-merge`, `contracts`, `contracts-harness` and `e2e` passed): those run only on GitHub. It also cannot
reproduce the runner's fonts or operating system. A green local run is therefore not the whole of Verify; read the jobs it names when it finishes.

### Before a push

`pnpm hooks:install` (once per clone) points git at `.githooks/`. Its `pre-push` runs `pnpm ci:local --job static --job typecheck`, the fast jobs, and prints
that `tests`, `game-simulations`, `coverage-merge` and `e2e` were not run: run them with `pnpm ci:local` before a push that changes behaviour, a game's
layout or its touch controls. `git push --no-verify` skips the hook for one push.

## Skills stay true

`src/skill-policy.ts` checks every `skills/<name>/` folder: SKILL.md exists, names itself the folder's name, has a description of up to
1,024 characters and is at most 500 lines; every `references/` file is linked from SKILL.md and every link exists; every repository path
and root `pnpm` script a skill names exists; and no file names the platform (the SDK's package scope), so a rename cannot leave a skill
stale. The guide for people is `docs/product/build-a-game-with-an-agent.md`.

## Ownership

Platform engineering.
