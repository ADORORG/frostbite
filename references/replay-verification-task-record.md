# Replay verification and the run record (G6 spike)

Branch `feat/replay-verification`, on top of `feat/wallet-widget`; baseline `d151cf8`. Plan:
`docs/product/plan-g6-replay-verification.md`. Specification: `docs/product/run-record.md`.

## What the spike found (read before relying on it)

- **FROST·BITE cannot be replay-verified as it is.** Board generation is already seeded, but the nine cabinets are
  real-time canvas games driven by an animation loop and elapsed time; round seeds come from `Date.now()`; there are 72
  `Math.random` calls; the block clock is a timer; the economy is tangled into one 1,000-line React component. Verifying
  real play means porting each cabinet to a fixed-step simulation that takes inputs by tick. That is not a spike; it is
  task #63.
- **`first-cashout` is a simulation event** (a diesel pot with no chain behind it). Verifying it would prove nothing; it
  stays self-reported, and the rules cannot earn it (a test pins that).
- **What can be verified** is a pick-based board and the icicle economy as pure arithmetic over a seed and a list of
  inputs. That is what was built and tested: `first-win` and `first-glacier`.
- **The shipped game does not use the core yet.** Until the ice-field cabinet is in the game (#61) and the claim path
  exists (#62), every FROST·BITE milestone is self-reported and must stay labelled so.

## Decisions taken on the documented defaults (review at merge)

- **The record** is a strict JSON document with logical-order inputs (no time), a 32-bit seed, game settings, a verifier id
  and version, and claims; canonical form (sorted keys, no whitespace), at most 5,000 inputs and 64 KB; SHA-256 digest of
  the canonical text. It lives in `@ador/game-sdk/run-record`, with a recorder a game builds it with.
- **The verifier is platform code**, a pure state machine (`GameVerifier`, defined in the SDK so a game needs nothing from
  the platform to write one), registered one explicit line per game in `configs/verifiers.ts` together with a sample run.
  The game's browser bundle is never executed on the server.
- **The record is hostile input.** `verifyRun` bounds it, never throws, and answers `verified` or `rejected` with a
  reason; a claim the replay did not earn is refused.
- **Replay proves legality, not a person.** Said in the spec, the package README and the plan; server-issued seeds, single
  use and rate limits (#62) are what narrow scripted records.
- **Mine placement uses a partial Fisher-Yates shuffle**, not "draw until enough are distinct" as the legacy generator
  does: it always takes a fixed number of draws, so untrusted input cannot make the server loop. Layouts therefore differ
  from the legacy cabinets' for the same seed; the ice field is a new board.
- Not built: a route or protocol method to submit a record, storing a verdict or a verified level, the game-side cabinet,
  any real-time cabinet port. Filed as #61, #62, #63.

## What was built

- `@ador/game-sdk/run-record`: schema, limits, `canonicalJson`, `createRunRecorder`, the `GameVerifier` and `Stepped`
  types.
- `@ador/game-verification` (new workspace): `defineVerifier`, `createVerifierRegistry`, `verifyRun`,
  `resolveVerificationPolicy`, `runVerifierConformance`.
- `games/frostbite/src/verifier`: `seeded.ts` (32-bit LCG, `pickDistinct`), `ice-field.ts` (the rules and the game's own
  economy constants), `sample-run.ts` (a legal run built with the recorder); exported as `@game/frostbite/verifier` and
  `/verifier-sample`.
- `configs/verifiers.ts` and `apps/web/test/verifiers.unit.test.ts`.

## Verification (run on this branch)

- Mutation proof: 37 guards broken one at a time and restored (the record schema and its limits, the canonical form, the
  recorder limit, every refusal in `verifyRun`, the verifier's failure handling, the registry, the policy ceiling, the
  conformance checks and their restoring of the clock, and every rule of the ice field and the economy including that
  `first-cashout` can never be earned). 35 were caught first time. **Two survived and were fixed:** a digest that depended on
  key order inside the record (no test reordered keys below the top level) and a board-seed-step test that computed its
  expectation from the constant under test. Both are caught on the re-run, and the working tree was unchanged afterwards
  apart from this record.
- `pnpm format:check`, `pnpm lint` (45 workspaces, 1,394 files, repository policy included; it caught a 326-line test file,
  split) and `pnpm typecheck`: passed.
- Coverage (statements / branches / functions / lines): `@ador/game-sdk` 98.4/98.1/98.4/98.5; `@ador/game-verification`
  100/96.1/100/100; `@game/frostbite` 100/96.7/100/100 (the verifier directory is in its coverage set); web unit tests 71
  passed, including `verifiers.unit.test.ts` (conformance for every registered verifier, manifest agreement, the sample
  verified, `first-cashout` refused, a glacier the icicles do not pay for refused, the seed binding, digest stability).
- Not run: e2e. Nothing the browser loads changed (the registry is not imported by the app yet).

## Found along the way

- My formatting command rewrote the whole lockfile (13,000 lines) and 33 legacy game files that must stay as copied.
  Both were restored from the parent commit before landing; formatting is now run from the repository root with explicit
  paths, and never on `pnpm-lock.yaml`.
- A commit of mine contained a syntax error in a test (a partial edit of a multi-line statement); caught by the next
  run and amended before anything was pushed.
- `{ mines: null }` was accepted as "not given" by `config.mines ?? default`; a test found it and the rules now check any
  setting that is given.
