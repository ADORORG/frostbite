# W3-04 — Media signature, MIME, size, dimension, and checksum validation

Status: converged
Baseline: `b348685` (clean worktree)
Started: 2026-10-06
Depends on: W3-03 (converged). W2-10B was set to `blocked` on external physical evidence so this
task could start; that is a ledger decision approved by the user on 2026-10-06.

## Objective and done criteria

Turn a `pending-validation` asset into an explicit, durable, terminal outcome by streaming its
private object and validating actual bytes: file signature, declared-versus-observed media type,
byte size, decoded dimensions/pixels, and a server-computed SHA-256. Nothing client-supplied
(filename, extension, type, checksum, dimensions) is trusted (ADR-004).

Done requires: PNG/JPEG/WebP accepted; disallowed types, MIME mismatch, oversize bytes, oversize
dimensions/pixels, truncated/corrupt files, and polyglots rejected with stable reason codes;
idempotent and retryable processing; positive, negative, concurrency, retry, and
storage-failure tests; adversarial fixtures; mutation proof of each guard. Validation
must not publish, derive thumbnails (W3-05), or clean up objects (W3-07). The activity is a system
activity with no user-facing surface; the asset's owner is unchanged and no new authority is granted.

## Facts established at the baseline (before this task)

- Completion persists an asset (`pending-validation`) and an identifier-only outbox event
  `uploads.assetprocessing.requested.v1` (`packages/shared/src/uploads/contracts.ts`). The only
  asset state today is `pending-validation`; W3-03 recorded that W3-04 must stream and revalidate
  the object because the `HEAD` observation can be stale.
- `ObjectStoragePort.read` returns a Node stream; it is the only byte-reading boundary.
- Per-purpose byte caps exist in `defaultUploadPolicy` (5/15/25/25 MB) and are enforced at intent
  creation. **No width, height, or decoded-pixel limit exists anywhere.** D07 records
  `max_original_bytes: ""` and `max_decoded_pixels: ""`; ADR-004 requires them as typed policy.
- ADR-004 leaves the decoder library and isolated runtime to be selected with a maintenance,
  security, license and compatibility review. No media package or decoder dependency exists.
- **No consumer receives the processing event.** The signed Inngest adapter is blocked by
  `references/workflow-adapter-gate.md` (deprecated transitive dependencies). W3-04 can therefore
  deliver a provider-neutral, idempotent validation activity; it cannot claim an automatic
  end-to-end trigger until that gate is resolved. This must be stated honestly in the UI/ops docs.

## Decisions (approved by the user, 2026-10-06)

1. **Limits (D07 gap):** 8192 px maximum width and height and 40 megapixels decoded, as typed upload
   policy (`maxImageDimension`, `maxImagePixels`), overridable by configuration. The existing
   per-purpose byte caps (5/15/25/25 MB) are accepted as the original-byte limits.
2. **Decoder:** a structural parser with no third-party dependency now (`@ador/media`); a vetted
   decoder and its ADR arrive with W3-05, where thumbnails require decoding. No dependency was added.

## Delivered design

- `packages/media`: pure `validateImage`; PNG/JPEG/WebP structural parsers; stable reason codes.
- `assets` gains validation outcome columns, `validated`/`rejected` states, and the
  `assets_validation_coherent` CHECK. Migration `20261006063740_square_nightcrawler`.
- `@ador/uploads`: `AssetValidationRepository` port, Drizzle adapter (conditional first-writer-wins
  record), and `createAssetValidationService` (bounded read, provider binding, idempotent replay).
- Shared contract: states, `assetRejectionReasons`, and the new policy fields.

## Known limits and handoffs (honest scope)

- **Not triggered:** no consumer delivers `uploads.assetprocessing.requested.v1`; the workflow
  adapter is gated. Assets stay `pending-validation` until a trigger exists. W3-08 must not claim
  automatic end-to-end processing without it.
- **Pixel stream not decoded:** a well-formed container may still fail decoding, and a header can
  declare smaller dimensions than its stream decodes to. The recorded width/height are therefore
  declared values. W3-05 must treat a decode failure or a decoded size that differs from the
  recorded size as a terminal rejection (add reason codes), and enforce the pixel limit while
  decoding, before generating derivatives.
- **Overwrite window:** the recorded `entityTag` pins the validated bytes; publication must copy with
  `copyPrivateToPublicIfAbsent({ sourceEntityTag })` and re-verify the hash.
- **Missing object:** retryable error; abandoned-intent cleanup is W3-07.
- **Concurrency:** each run buffers up to the declared size (at most 25 MB today); the trigger must
  bound concurrent runs (W8-06). Nothing in the activity limits them.
- **Metadata** (EXIF/ICC/XMP) is untouched here; derivatives strip it (W3-05).

## Defect found by tests during implementation

The first `assets_validation_coherent` draft accepted a `validated` row with a NULL hash, because
`NULL ~ regex` is UNKNOWN and a CHECK accepts UNKNOWN. The constraint test failed, every required
field now carries an explicit `IS NOT NULL`, and the migration was regenerated before commit.

## Verification

Root gates on the final code (no code or test file changed afterwards; documentation was edited
afterwards, and `format:check`, `lint`, and `git diff --check` were rerun after the last edit), run
sequentially with no concurrent edits: `env:check`,
`format:check`, `typecheck`, `lint`, `test:unit`, `test:integration` (real PostgreSQL), `test:coverage`,
`db:check`, and `test:e2e` (114 passed, 6 existing WebAuthn skips) all passed; `git diff --check` clean.
Coverage: `@ador/media` 100% statements/branches/functions/lines; `@ador/uploads` 99.30% statements
and 97.02% branches; `@ador/shared` 100% statements and 97.64% branches; merged thresholds passed.
Largest handwritten source/test file: 231 lines. No third-party dependency was added: the lockfile
gains only importer entries for `@ador/media` (workspace links and dev tooling at versions already
pinned elsewhere) and the `@ador/uploads` link, with no new package or version in the graph.

Mutation proof (each deliberate defect applied alone, the relevant suite run, the source restored
byte-for-byte): about 110 mutations across the three parsers, signature detection, limit checks, hash,
service guards (policy size cap, provider length, read cap, short object, provider binding, replay,
winner reporting, limits, entity tag, field mappings, clock), the Drizzle adapter (conditional
record, final mapping, every persisted column, declared-intent mapping), the migration CHECK clauses,
and the policy defaults/ceilings. Survivors were each repaired or removed as follows.

- Equivalent code removed: the redundant JPEG segment-overrun clause, the PNG 2^31 chunk ceiling, and
  two redundant JPEG frame-length clauses.
- Test gaps closed: JPEG signature, scan header length 0/1, null marker, stray bytes resembling a
  length, fill bytes before a restart marker, second SOI; PNG short/long header and non-IHDR first
  chunk of header size; WebP short lossy/lossless chunks with plausible prefixes (which otherwise read
  outside the chunk); read-cap observability; hash, clock, `updatedAt`, and purpose mappings.
- A seeded fuzz-style test (mutation of every real fixture plus random bytes, about 18,000 inputs per
  run) fails on any thrown error. It is evidence, not proof; each read is also bounds-guarded and
  mutation-checked.

## Defects found by review and repaired

F1 a second SOI marker let a JPEG hide bytes inside an unchecked "segment"; F2 `recorded` versus
`replayed` was inferred from object identity and is now explicit in the port; F3 the dimension limit
had no int4 ceiling although width/height are `integer` columns; plus the CHECK NULL defect above and
two test-typing violations (an `unknown` and an unchecked cast).

## Deep-review convergence

Earlier passes in this task each found and repaired defects (listed above), so the clean streak was
restarted several times. The final three consecutive passes ran on the frozen tree, after the last
code and documentation edit, and changed nothing.

| Pass | Method                                                               | Result |
| ---- | -------------------------------------------------------------------- | ------ |
| 1    | M1 whole-file reads of the changed documentation and final source    | Clean  |
| 2    | M4 every numeric and factual claim checked against logs and the repo | Clean  |
| 3    | Adversarial review: misleading claims, attack surface, failure modes | Clean  |

Verdict: **Converged** (2026-10-06). Passing gates, coverage, and mutation results are evidence, not
a claim that the feature is end-to-end live: nothing triggers validation yet (see the handoffs), and
the pixel stream is not decoded. W3-05 consumes the `validated` outcome and must not trust the
recorded dimensions or any pixel data without its own decoder checks.
