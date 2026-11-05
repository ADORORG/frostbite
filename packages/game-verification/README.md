# `@frostbite/game-verification`

The platform side of **replay verification** (G6): given a game's run record, replay it on the server with the game's own
deterministic rules and say which milestones the run earned. The record format is in `@frostbite/game-sdk/run-record`; the
specification is `docs/product/run-record.md`.

## Public API

- `@frostbite/game-verification/node`: `createGameVerifiers({ games, playRoot })` loads each game's published `verifier.js` from
  `<playRoot>/<gameId>/` for the games whose manifests pin one, and returns the registry and the problems (games left
  self-reported, and why).
- `@frostbite/game-verification/loader`: `loadGameVerifiers`, the same with the file reader and runners injected. It checks the
  pinned digest, the identity the manifest names, and that the game's sample run verifies, and refuses a game it has no safe
  runner for.
- `@frostbite/game-verification/runner`: the `VerifierRunner` port and `createInProcessRunner`, which runs a first-party artifact
  in a `node:vm` context with a per-call time limit. **It is not a security boundary** and is used only for the platform's own
  games; a sandboxed runner for anyone else's is not planned (ADR-018 Amendment 2).

- `@frostbite/game-verification/verifier`: re-exports `GameVerifier<State>` (a pure state machine: `init`, `step`, `earned`; defined in the SDK so a game needs nothing from the platform) and
  `defineVerifier`, which folds the state type away so different games share a registry.
- `@frostbite/game-verification/registry`: `createVerifierRegistry` (explicit, one verifier per game, found by game id).
- `@frostbite/game-verification/policy`: typed limits (`maxInputs`, `maxRecordBytes`), never above the SDK's ceilings.
- `@frostbite/game-verification/verify`: `verifyRun(registry, raw, policy)` answers `verified` (the milestones earned and the
  record's SHA-256 digest) or `rejected` (a reason), for any input, and never throws.

## Invariants

- A record is hostile input. It is validated, measured and bounded before any replay, and the replay is at most
  `maxInputs` steps. The caller limits the body's size before parsing it.
- A verifier is the game's own published rules, loaded only by the digest its manifest pins, and the platform contains no game's
  rules. The game's browser bundle is never executed on the server. A verifier uses its seeded generator and nothing else: no
  clock, no randomness, no I/O.
- A claim the replay did not earn is refused; a milestone the replay earned that was not claimed is simply not claimed.
- Replay shows the inputs are **legal** and reach the claimed result. It does not show a person played them.

## Not here

Issuing runs, storing a verdict, the verified level on the milestone record and the routes a game submits to. They belong to
the claim path: `@frostbite/game-runs`, `@frostbite/game-saves` and `@frostbite/feature-games` (see `docs/product/run-record.md`).

Run `typecheck`, `test:unit`, `test:integration` and `test:coverage` from this workspace.

## Ownership

Platform games team.
