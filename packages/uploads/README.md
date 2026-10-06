# `@ador/uploads`

Provider-neutral application and persistence boundary for durable direct uploads.

## Public API

`createUploadIntentService` validates policy, persists a quota reservation idempotently, and only
then asks `ObjectStoragePort` for a private presigned upload. `createDrizzleUploadIntentRepository`
implements concurrency-safe PostgreSQL reservation.

`complete` verifies the private object exists and has the exact declared byte length. The repository
then atomically creates one pending asset, marks its intent completed, and enqueues the identifier-only
processing event. Replays return that same asset without another storage lookup.

## Invariants

- Authentication is required by the delivery operation.
- The intent exists before a bearer upload URL is issued; URLs are never persisted.
- Each intent is bound to the provider that issued its URL; provider changes fail closed.
- User-row locking serializes the configurable active-intent quota.
- An idempotency key cannot be reused with different input.
- Provider failure releases the active reservation for a same-key retry.
- Completion is owner-scoped, expiry-aware, concurrency-safe, and transactional with its outbox event.
- Completion means accepted for validation, not trusted media.

## Asset validation (W3-04)

`createAssetValidationService.validate({ assetId })` is a provider-neutral, idempotent activity. It
streams the private object under a read cap equal to the declared size, validates the bytes with
`@ador/media`, and conditionally records one terminal outcome (`validated` with SHA-256, detected
type, dimensions, validator version, and the entity tag of the exact bytes hashed; or `rejected`
with a stable reason). A repeated or concurrent run returns the persisted winner. Storage failures
throw before any state change, so the asset stays `pending-validation` and retryable. Provider
mismatch is reported explicitly and never validated.

`validated` is not publication: publication must later copy conditionally on the recorded entity
tag, because a presigned upload credential can outlive completion and overwrite the object.
The recorded width and height are the dimensions the container declares; the pixel stream is not
decoded until W3-05, which must confirm them.

**Not yet connected:** nothing invokes this activity. The signed workflow adapter is gated
(`references/workflow-adapter-gate.md`), so `uploads.assetprocessing.requested.v1` events are
written to the outbox but not delivered. Assets remain `pending-validation` until that adapter or
an explicitly approved trigger exists. Each run buffers up to the declared size (policy-capped), so
the future trigger must also bound concurrent runs (W8-06). A missing object is a retryable error
here; abandoned-upload cleanup belongs to W3-07.

## Asset processing (W3-05)

`createAssetProcessingService.process({ assetId })` takes a `validated` asset, reads its private
object (bounded by the recorded size), requires the bytes to hash to the recorded SHA-256 (otherwise
`unprocessable: content-changed`), and passes them to an injected `ImageProcessor`. The processor is a
port; this package never imports a decoder. Derivatives are written as private, write-once,
content-addressed objects (`derivatives/<asset>/<spec-version>/<kind>-<sha256>.webp`); a retry that
finds an identical object continues. One transaction then moves the asset to `processed` and inserts
its `asset_derivatives` rows, or to `unprocessable` with a stable reason. Replays return the persisted
winner. Storage, launch, and worker-protocol failures throw before any state change, so the asset
stays `validated` and retryable. Derivatives are not published and have no public URL.

Like validation, processing has **no trigger yet** and its concurrency is the caller's to bound.

Configuration comes from the validated shared upload policy. Run `env:check`, `typecheck`,
`test:unit`, `test:integration`, or `test:coverage`. Platform engineering owns this package.
