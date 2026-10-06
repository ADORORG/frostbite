# W3-05 — Thumbnails and previews for PNG, JPEG, and WebP

Status: converged
Baseline: `cf3c5c5` (clean worktree)
Started: 2026-10-06
Depends on: W3-04 (converged).

## Objective and done criteria

Decode each `validated` asset with a vetted decoder, confirm the decoded size equals the recorded
declared size, enforce the pixel limit while decoding, strip metadata, and write normalized derivatives
(thumbnail and preview) as distinct private objects. A decode failure, a size disagreement, changed
source bytes, or a limit violation becomes a terminal, stable-coded outcome. Derivatives are not
published (publication depends on D13 and a later task). The decoder must be pluggable, isolated, and
unit-testable, following the repository's port/provider standard.

## Decisions (approved by the user, 2026-10-06)

- Derivatives: 256 px and 1024 px longest side, lossy WebP quality 80, EXIF auto-oriented then source
  metadata stripped, alpha kept, never enlarged.
- Isolation: a child process killed on timeout. Limits: 30 s wall time, 5 MB per derivative, 512 MB
  worker heap, all typed configurable policy.
- Decoder: `sharp` 0.35.5, including its LGPL-3.0-or-later prebuilt libvips (ADR-013).
- Direction reinforced by the user: pluggable, clean, well-structured, reusable, unit-testable code that
  follows the established standard.

## Delivered design

- **Port and capability**: `ImageProcessor` and `media-processing:image-derivatives` in
  `@ador/media/processing`, mirroring `@ador/object-storage`. No decoder in domain code.
- **Provider adapter**: `providers/media-processing/sharp`, registered by one line in
  `configs/providers.ts`, like the R2 provider. `process-image.ts` is the only file importing `sharp`.
  Orchestration (`isolated-processor.ts`) depends on a `WorkerLauncher` port and an injectable
  scheduler; reply validation (`reply.ts`) and the frame protocol are pure. The Node launcher is the
  only code that spawns a process.
- **Activity**: `createAssetProcessingService` in `@ador/uploads` (port-only, idempotent,
  content-hash verified, write-once content-addressed derivative keys, conditional transition).
  `AssetProcessingRepository` port plus a Drizzle adapter; shared bounded-read helper reused with
  validation.
- **Persistence**: states `processed` and `unprocessable`, `processing_completed_at`, a restructured
  five-state `assets_validation_coherent` CHECK (its own module), an `asset_derivatives` table, four
  new reason codes, and migration `20261006082016_tranquil_night_thrasher`.
- **Policy**: `DerivativePolicy` in `@ador/shared/uploads` with validated overrides.
- **Dependency**: ADR-013. The repository already resolved `sharp` 0.35.3 through Next.js, which carries
  a high advisory; a `pnpm` override now resolves every `sharp` to the single 0.35.5.

## Known limits and handoffs (honest scope)

- **Not triggered:** nothing invokes validation or processing; the workflow adapter is gated. Assets
  stay `pending-validation`/`validated` until a trigger exists. The trigger must also bound concurrent
  runs (each holds up to the source size plus up to 40 MP of pixels) and set a container memory limit;
  `--max-old-space-size` does not cap native memory.
- **Strict decode trades convenience for safety:** `failOn: warning` detects truncated JPEG entropy
  data that structural validation cannot, but a decoder warning on an otherwise usable image becomes
  `decode-failed`. Revisit with real creator files before launch.
- **No publication:** derivatives are private objects with no public URL; D13 and a later task decide
  publication, using the recorded hash and entity tag.
- **Platform faults stay retryable:** a worker that exits with its own failure code (cannot start,
  missing native decoder, protocol violation), a malformed reply, or a launch failure rejects instead
  of recording an outcome; only our kills and signal deaths are terminal limit violations. Review found
  that treating every non-zero exit as terminal would let a broken deployment permanently reject
  uploads.
- **Worker is a TypeScript file** run with Node type stripping; a bundled deployment must ship it.
- **Equivalent redundant checks kept for type narrowing:** the `request !== undefined` guard in
  `reply.ts` (the count check already proves it) and the JSON parse fallback in `protocol.ts` (an
  empty value fails schema validation to the same null).
- `sharp`'s prebuilt libvips is LGPL-3.0-or-later (accepted); deployment images need a supported
  platform.

## Verification

Root gates on the final code, run sequentially with no concurrent edits, all passed: `env:check`,
`format:check`, `typecheck`, `lint`, `test:unit`, `test:integration` (real PostgreSQL and real
`sharp` worker processes), `test:coverage`, `db:check`, and `test:e2e` (114 passed, 6 existing
WebAuthn skips). No code or test file changed after that run; only documentation did.
Coverage: `@ador/provider-media-processing-sharp` 100% statements/branches/functions/lines;
`@ador/media` 100%; `@ador/uploads` 99.52% statements and 97.87% branches; `@ador/shared` 100% and
97.72%; merged thresholds passed. Largest handwritten source/test file: 223 lines. The lockfile has a
single `sharp` (0.35.5); no new deprecated package entered the graph.

Mutation proof (each defect applied alone, the relevant suite run, the source restored byte-for-byte):
about 100 mutations across the decoder pipeline (strictness, pixel limit, size check, orientation,
fit, enlargement, quality, metadata, derivative order), the frame protocol, reply validation, the
orchestration (output cap, exit handling, timeout, heap, cancellation), the launcher (environment,
signal, heap flag), the processing service, the Drizzle adapter (conditional transition, every
persisted and read-back field, ordering), the migration CHECK and unique clauses, and the policy.
Survivors were repaired or documented: the strict `failOn` mutant was a harness artifact (it mutated a
comment) and is killed once targeted; reply kind order, header cap, header bounds, SIGKILL, heap flag,
clock, ordering, and several persisted fields each needed a sharper test; one clause was removed as
redundant; two checks are kept for type narrowing and documented as equivalent.

## Defects found by review and repaired

Direction from the user mid-task led to restructuring the work into the provider standard (port plus
typed capability, adapter registered by one line, injectable launcher and scheduler). Review then
found: every non-zero worker exit was treated as a terminal file rejection, which would let a broken
deployment permanently reject uploads (now only our kills and signal deaths are terminal); a database
`ORDER BY` that was never proven; and a pre-existing high `sharp` advisory in the transitive 0.35.3
(resolved by the override). Tests also exposed that `NodeJS.ProcessEnv` is augmented by Next.js, which
changed the worker environment to carry only `NODE_ENV`.

## Deep-review convergence

| Pass | Method                                                                   | Result |
| ---- | ------------------------------------------------------------------------ | ------ |
| 1    | M1 whole-file reads of the final provider, service, and adapter source   | Clean  |
| 2    | M4 capability, state, reason, and kind vocabularies across every layer   | Clean  |
| 3    | M11 AGENTS.md rules: limits, banned constructs, vendor isolation, config | Clean  |

Verdict: **Converged** (2026-10-06). Gates, coverage, and mutation results are evidence, not a claim
that processing is live: nothing triggers validation or processing yet.
