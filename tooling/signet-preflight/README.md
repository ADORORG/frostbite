# `@repo/signet-preflight`

Developer tooling. Not shipped, and nothing in the platform imports it.

Checks, before any coin is spent, what a first signet run of the rewards chain needs. It reads, and never signs, broadcasts or writes.

## Public API

`pnpm signet:preflight [--env <file>]` reads the app's settings (default `apps/web/.env.local`, with the process environment over it)
and prints one verdict per check, then exits `0` (all passed), `1` (something is wrong or was skipped), or `2` (nothing wrong, but
something could not be checked).

| Check              | Passes when                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Settings           | The platform's own parser (`parseRewardsChainEnvironment`) accepts `REWARDS_*`.                       |
| Template code      | Each template in `rewardsPolicy.templates` is in `REWARDS_TEMPLATES_DIR` and has the released hash.   |
| Indexer            | The indexer is no more than `rewardsPolicy.delay.maxLagBlocks` behind the tip (the site lamp's rule). |
| Auth-token factory | Code is deployed at `4:65517`, which the game template calls to make an auth token.                   |
| Fee                | The estimated cost of publishing each template at the quoted rate is within `REWARDS_MAX_FEE_SATS`.   |

Verdicts: `PASS`, `FAIL`, `UNVERIFIED` (the node could not be asked, so nothing is claimed) and `SKIPPED` (settings not usable).
`runPreflight(source, platform, policy?)` is the same with the environment, `fetch` and file reads given, so it can run on a fake node.

## Invariants

- Read-only: no signing, no broadcast, no database, no file written.
- The decisions it checks against (`delay`, `feeTargetBlocks`, `templates`) are the platform's own policy, not copies.
- The fee is an estimate (packed code at a quarter weight plus fixed framing); the platform's builder prices the real
  transaction. It is a check that the ceiling is not clearly too low, not a quote.
- A check that cannot be made is `UNVERIFIED`, never `PASS`.

## Not covered

`esplora_broadcast` acceptance (it needs a real transaction), that a created instance reports its template's code hash, wallet
signing with Xverse, UniSat or OYL, and the staff account and game manifest.

## Test commands

`pnpm --filter @repo/signet-preflight test:unit`, `test:integration` (runs the real command against a node on a local port),
`test:coverage`.

## Ownership

Platform games team. If `rewardsPolicy` or the settings change shape, the checks follow.
