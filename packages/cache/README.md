# `@ador/cache`

The platform's one place for keeping a reading for a while: a server-side read cache for what many visitors ask of the same
upstream, and a browser-side expiring store for what a page may keep between loads. Nothing else in the repository implements
its own time-to-live, single-flight or stale-while-error logic.

## Public API

- `createReadCache<Value>({ now, policy, onRefreshFailed? })` (package root): `read(key, ask)` returns `{ value, readAt }`.
  - Younger than `policy.freshMs` the reading is served as it is.
  - Between `freshMs` and `maxStaleMs` the old reading is served at once while one new reading is taken in the background; if that
    fails the old reading is kept and `onRefreshFailed(key)` is told. `maxStaleMs === freshMs` is a plain time-to-live.
  - Older than `maxStaleMs` nothing is served: the caller waits for a new reading or gets its failure.
  - Callers that arrive while a reading is on its way share it; a failed reading is never kept; a reading still pending after
    `freshMs` is not waited on; a reading that finishes late never replaces a newer one.
- `assertReadPolicy(policy)`: whole, non-negative milliseconds, `maxStaleMs` not below `freshMs`.
- `@ador/cache/expiring-store`: `createExpiringStore({ storage, schema, prefix, maxAgeMs, now })` with `read`, `write`, `remove`.
  Browser-safe. Storage is advisory: missing, full, blocked or edited storage is a miss, and a stored value is checked against its
  schema and its age before it is used.

## Invariants

- A reading is always returned with when it was read, so whoever shows it can say how old it is. Old data is never presented as new.
- Policy values (`freshMs`, `maxStaleMs`, `maxAgeMs`) come from the caller's configuration; this package holds none.
- Failure reasons never cross the cache: it reports which key failed, not why.

## Verification

`pnpm --filter @ador/cache typecheck test:unit test:integration test:coverage`. Platform engineering owns it.

## Ownership

Platform engineering.
