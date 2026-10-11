# W4-01 — Collection records, versioned drafts, metadata, supply, and items

Status: completed 2026-10-09; formal deep review Converged (see "Review")
Baseline: `b5939f6` (W4-00), branch `feat/w4-01-collection-records`
Depends on: Week 3, creator admission, W4-00.

## Objective and done criteria

An approved creator can create a collection draft, give it metadata and a planned supply, add ordered
items that use their own processed images, preview them with signed renditions, and edit under revision
control; nobody else can see or change it; nothing is public and nothing is a deployment. Done means the
rules hold in the database, not only in the API, and the whole path ran on real services.

## What was built

- `@ador/shared/collections`: draft and item schemas, engineering limits, the asset purposes a draft may
  reference, and the HTTP contract of seven operations. `@ador/shared/http` gained `requestFingerprint`
  (key-order-independent digest). `@ador/shared/chain` gained `chainOptionSchema` (a projection of
  `ChainConfig` that needs no confirmation policy) and text variants of the chain schemas.
- Database: `collections` and `collection_items` with a revision counter, CAIP-2 target chain,
  per-creator and per-collection idempotency keys, and CHECK constraints for every stored limit
  (migration `20261009223255_illegal_swordsman`).
- `@ador/collections` (new): the service and the PostgreSQL repository.
- `@ador/feature-collection-studio` (new): the authenticated API (create, list, read, save, add, update,
  and remove item), registered in `configs/features.ts`; `configs/chains.ts` supplies the target chains.
- `@ador/uploads`: `getMany` presents the creator's own assets by id, so previews reuse the library's
  signing.
- Test infrastructure: `@ador/test-kit` gained `storage-registry` (moved from the uploads tests) and
  `creator-database` (shared seeding); `memoizeUntilFailure` moved to `@ador/plugin-kit/lazy`;
  `createDatabaseFromEnvironment` in `@ador/database`.

## Decisions taken without the product owner (defaults, to be reviewed)

- A draft is one mutable record with a revision counter; frozen copies arrive at submission (W4-03).
  Drafts are not kept per save.
- Ownership is the creating user. Organisation ownership is not modelled yet.
- Engineering limits (not product quotas): name 120, description 4,000, provenance 2,000, item name 120,
  item description 1,000, 32 attributes per item, 10,000 items per collection, planned supply 1 to
  1,000,000.
- Only an approved creator may change a draft; a suspended or revoked creator can still read.
- A draft only targets a chain; the adapter family and version are recorded when a deployment binds it.

## Review

| Pass | Method                            | Result                                                                                                                                                                                                |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | M1 whole-file read                | Eligibility read was not locked against a concurrent suspension; the lock-and-eligibility preamble was repeated four times; the database lacked length checks for fields the schema bounds. All fixed |
| 2    | M4 contract diff                  | A duplicated seed fixture; otherwise producers and consumers agree                                                                                                                                    |
| 3    | M5 mutation proof                 | 37 mutants; two real gaps found (idempotent creation was not proven serialised; the race test did not exist) and closed; the only survivors are message-text and one placeholder                      |
| 4    | M11 house rules                   | Two assertions in tests, a duplicate fixture, a missing dev dependency; fixed                                                                                                                         |
| 5-7  | M6 gates, M1 re-read, M9 siblings | Zero findings and zero code edits: **Converged**                                                                                                                                                      |

Mutation notes: the suspension race is killed by removing the shared lock; creation serialisation is
killed by removing the advisory lock; the owner filter in `getMany` is killed by the uploads tests.

## Gates (final tree)

`env:check`, `format:check`, `typecheck`, `lint`, `test:unit`, `test:integration`, `test:coverage`
(merged thresholds pass), `db:check`, and `build` exit 0 and the full `test:e2e` passed. File lengths are
within 300 (repository policy passed). Coverage: `@ador/collections` 98.2 % lines and 94.0 % branches;
`@ador/feature-collection-studio` 100 %; the unreached lines are four "row is missing" guards after an
`INSERT ... RETURNING`, impossible by construction and kept for type narrowing.

## Findings and limits

See `docs/session-findings.md` (W4-01 section). Notable:

- The platform OpenAPI document failed to build because the branded chain schema used a transform, which
  JSON Schema cannot represent; text variants fix it (and a web integration test now guards it).
- The HTTP layer has no path or query parameters, so reading a draft is `POST .../read`.
- A creator may hold only two unfinished upload intents at once (`activeIntentLimitPerUser`), which the
  W4-02 wizard must respect when uploading images in bulk.
- Home page visual baselines were updated because the page truthfully shows the registered-feature
  count (now 10); two tests that hard-coded 9 now read the registry.
