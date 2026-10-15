# `@ador/game-verification`

The platform side of **replay verification** (G6): given a game's run record, replay it on the server with the game's own
deterministic rules and say which milestones the run earned. The record format is in `@ador/game-sdk/run-record`; the
specification is `docs/product/run-record.md`.

## Public API

- `@ador/game-verification/verifier`: re-exports `GameVerifier<State>` (a pure state machine: `init`, `step`, `earned`; defined in the SDK so a game needs nothing from the platform) and
  `defineVerifier`, which folds the state type away so different games share a registry.
- `@ador/game-verification/registry`: `createVerifierRegistry` (explicit, one entry per verifier id, bound to a game).
- `@ador/game-verification/policy`: typed limits (`maxInputs`, `maxRecordBytes`), never above the SDK's ceilings.
- `@ador/game-verification/verify`: `verifyRun(registry, raw, policy)` answers `verified` (the milestones earned and the
  record's SHA-256 digest) or `rejected` (a reason), for any input, and never throws.

## Invariants

- A record is hostile input. It is validated, measured and bounded before any replay, and the replay is at most
  `maxInputs` steps. The caller limits the body's size before parsing it.
- A verifier is platform code, held in the registry and reviewed by pull request. The game's browser bundle is never
  executed on the server. A verifier uses its seeded generator and nothing else: no clock, no randomness, no I/O.
- A claim the replay did not earn is refused; a milestone the replay earned that was not claimed is simply not claimed.
- Replay shows the inputs are **legal** and reach the claimed result. It does not show a person played them.

## Not here

Storing a verdict, a verified level on the milestone record, the route a game submits a record to, server-issued
seeds and per-seed single use. They belong to the claim path (see the plan, `docs/product/plan-g6-replay-verification.md`).

Run `typecheck`, `test:unit`, `test:integration` and `test:coverage` from this workspace.
