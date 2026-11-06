# W3-05A — Signed Inngest adapter and upload pipeline trigger

Status: completed 2026-10-06 — gates green; deep review converged (three consecutive clean passes, no source edits between)
Baseline: `a152605` (clean worktree)
Started: 2026-10-06
Depends on: W3-04 and W3-05 (converged). Unblocks W3-06 through W3-08.

## Objective and done criteria

Nothing delivered `uploads.assetprocessing.requested.v1`, so validation (W3-04) and derivative generation
(W3-05) never ran. Implement the gated signed workflow adapter (`workflow-adapter-gate.md`) per ADR-003:
a provider adapter that publishes outbox events and hosts a signature-verified endpoint running the asset
pipeline, plus a host that runs the relay independently of the workflow provider.

The gate's re-entry criteria: (1) a recorded exception for the SDK's deprecated packages — ADR-014,
approved by the user on 2026-10-06; (2) the SDK graph reviewed and pinned — see below; (3) signed
endpoint rejection, stable event identity, duplicate delivery, retry exhaustion, provider outage,
database acknowledgement failure, and recovery covered by meaningful tests; (4) tests against the real
local runtime and all workspace gates passing.

## Decisions

- Exception approved: exactly `node-domexception@1.0.0` and `glob@10.5.0` under `inngest` 4.21.1
  (ADR-014). The lockfile gained exactly one new deprecated entry, `node-domexception@1.0.0`; `glob` and
  `crypto` were already present.
- **Proposed, awaiting approval:** the worker service hosts the signed endpoint, not the Next deployable
  (ADR-015, which amends one sentence of ADR-009). The reason is concrete: Next's standalone output
  cannot host the decoder's child process (a copied lone asset with no `sharp` beside it and no
  `"type": "module"`), and every workaround coupled the web deployable to a native decoder.
- The limits I chose and the user has not set are recorded as typed, overridable policy defaults in
  `@frostbite/jobs/policy`: 4 retries, 2 concurrent media steps, relay batch 10, 60 s lease, 8 attempts,
  1 s to 300 s backoff, 2 s idle and 5 s error polling. They are not environment values.

## Delivered design

- **Provider-neutral contracts and logic (`@frostbite/jobs`)**: activity contract; `runAssetPipeline`,
  parameterized over a durable `step`; typed workflow capabilities; the relay loop; policy. 100% coverage.
- **Mapper (`@frostbite/uploads`)** from the two services to the activity contract; a latent bug fixed along
  the way (validation replay on an already processed asset threw "incoherent").
- **Provider (`providers/workflows/inngest`)**: client, event publisher (event id as idempotency key,
  terminal versus retryable classification from real SDK errors), function wiring, signed endpoint
  factory via `inngest/edge`, registration and entrypoint. The SDK is imported only here.
- **Composition**: `createAssetPipelineResolver` in `@frostbite/feature-uploads/pipeline`.
- **Host (`apps/worker`)**: relay loop, signed endpoint, liveness, structured secret-free logs, clean
  shutdown; template, `env:check`, and Turbo env declarations for the five new `INNGEST_*` keys.
- **Shared infrastructure**: `@frostbite/http/node-adapter` (one Node-to-fetch bridge) and `@frostbite/test-kit`
  (disposable real Inngest server, REST reader, fetch server) used by the provider and worker tests.

## Findings from running the real runtime

- Self-hosted Inngest keeps every duplicate event record that races, but starts one run per event id;
  the guarantee is asserted at the run level, and tests read runs across all records for an id.
- The runs API reports `Failed` from a run's first failed attempt while retries are pending, so failure
  scenarios are judged by the observed call sequence after a quiet period.
- The SDK retries every non-2xx send five times (about 1.7 s) before throwing, including 400.
- The SDK edge handler builds URLs from the `Host` header, and forwards registration to its base URL, so
  one client carries the base URL for both publishing and serving.
- The deprecated-package scope: the SDK graph is 231 packages, 0 advisories.

## Defects found by review and repaired

- **Unauthenticated endpoint in hosted environments.** With `isDev` true the SDK skips signature
  verification, so `INNGEST_DEV=true` in preview or production would expose an endpoint that runs
  activities. The provider configuration now fails fast on that combination, using the platform's own
  `APP_ENV` schema.
- **Unbounded request buffering.** The Node adapter read whole bodies before any signature check, so an
  unsigned caller could make the worker allocate arbitrary memory. Bodies over 1 MiB are refused with
  413, from the declared length when present and while streaming otherwise.
- **Lost scenario.** A refactor silently removed the retry-exhaustion test, one of the gate's explicit
  criteria; it was found on re-reading the suite and restored.
- A latent validation-replay bug (an already processed asset made validation throw "incoherent").
- The ESM and `sharp` resolution failures that moved the endpoint host to the worker (ADR-015).

## Known limits and handoffs (honest scope)

- Nothing is deployed: the worker has no Dockerfile, health dashboard, or alerting (W8-06, W8-07), and
  Inngest Cloud has not been connected; only the self-hosted server has been exercised.
- ADR-015 is a proposal. If rejected, the composition root moves back to a Next route with a remote
  image processor behind the same port.
- A run that exhausts retries leaves the asset in its last persisted state (for example
  `pending-validation`) and the outbox row `delivered`; finding and replaying such assets is the
  reconciliation work of W3-07 and W8-07.
- The relay has no replay tooling beyond the existing failed-state inspection.
- Signing-key rotation (`signingKeyFallback`) is not wired; adding it needs one more inventory key.
- Graceful shutdown lets an in-flight media step finish; there is no hard deadline beyond the container's.

## Verification evidence (final tree, 2026-10-06)

Run from `the-well` after the last source edit (the only later change split
`packages/http/test/node-adapter.unit.test.ts` into two files plus `test/support/node-server.ts`):

| Gate                    | Result                         |
| ----------------------- | ------------------------------ |
| `pnpm env:check`        | exit 0                         |
| `pnpm format:check`     | exit 0                         |
| `pnpm typecheck`        | exit 0                         |
| `pnpm lint`             | exit 0                         |
| `pnpm test:unit`        | exit 0                         |
| `pnpm test:integration` | exit 0                         |
| `pnpm test:coverage`    | exit 0                         |
| `pnpm db:check`         | exit 0                         |
| `pnpm test:e2e`         | exit 0 (114 passed, 6 skipped) |

- Largest new or changed source file: 255 lines (`providers/media-processing/sharp/src/worker.ts`).
- Lockfile deprecated entries: `crypto@1.0.1`, `glob@10.5.0`, `node-domexception@1.0.0`, matching ADR-014.
- Logs: scratchpad `final-*.log`.

## Review convergence

Three consecutive passes on the final tree, with no source edit between them (only this record and the
ledger changed afterwards):

| Pass | Focus                                                                | Findings |
| ---- | -------------------------------------------------------------------- | -------- |
| 1    | Correctness: pipeline, activities, publisher, endpoint, relay loop   | none     |
| 2    | Boundaries: config validation, signed endpoint, body limit, shutdown | none     |
| 3    | Rule audit: banned constructs, `process.env`, URLs, file sizes, docs | none     |

Verdict: **Converged**. One documentation-only addition came out of the passes: Inngest deduplicates
event ids only within its retention window, so a relay re-publish after a very long outage could start
a second run. The activities are replay-safe (validation and processing return `replayed`), so the
second run is a no-op, but the window is not a hard guarantee.

## Mutation proof on the final tree (2026-10-06)

15 deliberate breaks across the config URL and hosted-environment rules, publisher idempotency and
terminal statuses, pipeline short-circuits, relay backoff, body limits, endpoint failure caching, and
the activity status mapping: all 15 were killed by a named test, and every file was restored
byte-for-byte (scratchpad `final-muts.out`).
