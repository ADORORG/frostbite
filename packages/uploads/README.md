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

**Triggered by the worker.** The signed workflow adapter (W3-05A) delivers
`uploads.assetprocessing.requested.v1` from the outbox and runs this activity, then processing. Each
run buffers up to the declared size (policy-capped), so the worker bounds concurrent media runs
(`maxConcurrentMediaRuns`). A missing object is a retryable error here; objects that were never
completed are removed by abandoned-upload cleanup (below).

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

Like validation, processing is run by the worker, which bounds its concurrency.

## Abandoned-upload cleanup (W3-07)

An intent that is never completed leaves, at most, a private object nobody refers to. Accepted
W3-02 policy: the upload window is 15 minutes, unclaimed objects become eligible for removal 24 hours
after it ends (`cleanupDelayMs`), and the intent record is kept 30 days (`intentRetentionMs`).

`createUploadCleanupService({...}).sweep()` removes those objects in one bounded pass
(`cleanupBatchSize`, default 50):

1. `UploadCleanupRepository.claim` atomically moves intents that are `reserved` or `failed`, past their
   cleanup time, without an asset, and written through the configured storage provider, to
   `abandoned`, oldest first, with `FOR UPDATE SKIP LOCKED`. It also returns `abandoned` intents whose
   object removal was never recorded. An abandoned intent can no longer be completed, re-reserved, or
   released, so deleting its object cannot race a user.
2. The service deletes each object from the private scope. Deleting a key that was never written is a
   no-op, so an upload the browser never started needs no special case.
3. `markObjectRemoved` records `object_removed_at`. A failed delete is reported and left unrecorded,
   so the next pass retries it; one failure never stops the batch.

Intents of another storage provider are never claimed (their objects cannot be removed from here), so
they cannot crowd out work that can be done. Passes running at the same time never lose an intent; one
that sees another's removal still pending may return it too, which is harmless because deleting and
recording are idempotent. The worker runs the sweep on a slow loop (`defaultMaintenanceLoopPolicy`).

## Access rules for private drafts

A draft (an upload intent, its object, its asset, and its renditions) is accessible to its **owner
only**. Staff and reviewer access to a frozen submission is a separate, later rule (W4-03); until then
no role widens it.

| Path                            | Rule                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Create an intent                | Authenticated; quota and idempotency keys are per user                                 |
| Complete an intent              | Owner only; another user's intent is indistinguishable from a missing one              |
| Release a failed reservation    | Owner only                                                                             |
| List assets and read renditions | Owner's assets only; renditions are signed per request for the owner (ADR-016)         |
| Object bytes                    | Private bucket; opaque random keys; a presigned URL reaches one key, for one operation |
| Validation, processing, cleanup | Worker-internal; not reachable from a user request                                     |

Every repository query that serves a user filters by the authenticated user's id. The integration
tests cover another user's completion, release, library, and identical idempotency key.

Configuration comes from the validated shared upload policy. Run `env:check`, `typecheck`,
`test:unit`, `test:integration`, or `test:coverage`. Platform engineering owns this package.
