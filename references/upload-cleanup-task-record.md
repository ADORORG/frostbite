# W3-07 — Private draft access and abandoned-upload cleanup

Status: completed 2026-10-09; formal deep review Converged (see "Review")
Baseline: `a63d2a5`
Depends on: W3-02, W3-03, W3-06 (completed). Unblocks W3-08.

## Objective and done criteria

Make the rule "a private draft is reachable only by its owner" explicit and tested on every path, and
remove the private objects of uploads that were never completed, without ever touching an object an
asset refers to. Done means: access rules are documented and covered by tests for each user-reachable
path; an abandoned intent's object is removed after the accepted delay, recorded, retried after a storage
failure, and never raced against a completion; the worker runs the sweep; and nothing outside the
accepted policy is invented.

## Accepted policy used (W3-02, unchanged)

Upload window 15 minutes; unclaimed private objects eligible for removal 24 hours after it ends
(`cleanupDelayMs`); intent records retained 30 days (`intentRetentionMs`). Both stay typed policy.

## Decisions

- **`abandoned` is a persisted terminal state, set before the delete.** A sweep first claims eligible
  intents (`reserved` or `failed`, past `cleanup_eligible_at`, no asset) by moving them to `abandoned` in
  one transaction with `FOR UPDATE SKIP LOCKED`, and only then deletes the object. Claiming first means a
  user can never complete, re-reserve, or release an intent whose object is being deleted; deleting first
  would race a retry of a failed intent that reuses the same object key. The state is a new enum value
  (migration `20261008134455_left_glorian`).
- **Removal is recorded separately** (`object_removed_at`, allowed only on `abandoned` by a CHECK), so a
  crash or storage outage between claim and delete leaves the intent claimable again: the next sweep
  returns abandoned intents with removal outstanding.
- **Only intents of the configured storage provider are claimed.** Another provider's objects cannot be
  removed from here, and claiming them would fill every batch and starve real work after a provider
  change. They stay untouched for the matching provider.
- **Progress is "removed", not "claimed".** The worker loop treats a pass as work only when something
  was removed, so a failing store is retried after the idle delay instead of in a tight loop.
- **One generic drain loop** (`@ador/jobs/drain-loop`) now serves both the outbox relay and the cleanup;
  `runOutboxRelayLoop` is a thin wrapper with unchanged behavior and tests.
- **One memoizing helper** (`memoizeUntilFailure`) replaces four copies of the "build once, forget a
  failure" pattern in the uploads feature.

## Access rules for private drafts

Documented in `packages/uploads/README.md` and enforced by owner-scoped queries: create (per-user quota
and idempotency keys), complete, release, library and renditions are owner only; another user's intent
is indistinguishable from a missing one; object keys are opaque and random, the bucket is private, and a
presigned URL reaches one key for one operation; validation, processing, and cleanup run only in the
worker. Staff or reviewer access to frozen submissions is deliberately not defined here (W4-03).

## Delivered

- Policy `cleanupBatchSize` (default 50, range 1–500); migration adding `abandoned`, `object_removed_at`,
  a coherence CHECK, and a partial index for the sweep.
- `@ador/uploads`: `UploadCleanupRepository` (port), `createUploadCleanupService`, and the Drizzle
  adapter; `@ador/feature-uploads/cleanup` composes it lazily from the storage capability.
- Worker: `runCleanup` beside `runRelay`, started from `main.ts`; the pass itself is `createCleanupPass`
  (`src/cleanup.ts`, beside `relay.ts`) so the "progress is what was removed" rule is unit-tested; each pass
  logs its counts, and failures are logged with intent ids and messages only.
- Smoke script and S3 conformance now prove that deleting a missing key succeeds, which cleanup of
  never-started uploads relies on.
- Tests: service and cleanup-pass unit tests; repository integration tests against PostgreSQL (eligibility, not-yet-due,
  completed and cancelled, exact boundary, ordering and limit, retry until recorded, foreign provider,
  an asset-backed intent is never claimed even with an inconsistent state, a row another transaction
  holds is skipped instead of waited for, concurrent passes, cannot complete/re-reserve/release once
  abandoned, CHECK enforced by the database); worker integration tests against PostgreSQL (removal,
  completed upload untouched, a backlog drained in policy-sized batches, outage then later run); a
  cross-user idempotency-key test; the process test now plants secret values and requires that no log
  line contains them (it previously matched the word "secret", which a message naming a missing setting
  legitimately contains).

## Review-found defects fixed

The formal review (read of every changed file, about 70 deliberate breaks, `EXPLAIN` of the claim query)
found, and fixed with tests that fail without the fix:

- The "never claim an object an asset refers to" guard covered only one of the two claim branches and was
  untested; it now covers both and is proven with an inconsistent row.
- A test of mine asserted that an abandoned intent cannot be completed but used a time outside the upload
  window, so it would have passed without the state check; it now uses a time inside the window.
- Nothing proved that the claim skips a locked row (a completion in flight) rather than waiting; it does,
  and a test holds a row lock to show it.
- The batch size policy reached the service through untested wiring; a backlog test now proves a 51-row
  backlog drains as 50 then 1.
- The smoke script's "delete twice" step passed with a single delete; it is now proven against a store
  that refuses the second delete.
- The cleanup's clock was imported from the media pipeline module; it has its own module.
- Two test files were past the 250-line threshold and were split by responsibility.

Mutation proof: all but one deliberate break was killed. The survivor changes only the fallback text used
when a rejection is not an `Error`; a test of copy would be decorative, so it is accepted. The partial
index was confirmed by `EXPLAIN` to be used on a 20,000-row table.

## Flaky test found and fixed

`registration.integration.test.ts` imports the whole entrypoint (React and the studio UI) and failed
about one run in three under CPU contention with the default five-second limit. It has an explicit,
commented limit now.

## Open decisions (not invented, not implemented)

- **Retention of rejected, unprocessable, or abandoned-after-completion assets' private objects.** ADR-004
  lists "draft, rejected, audit, and published retention policies" as configuration still required, and no
  value has been accepted. Cleanup here covers only uploads that were never completed.
- **Whether intent rows are deleted after the 30-day retention.** The accepted policy says they are
  retained for 30 days; it does not say they are purged. Rows are kept.

## Known limits

- A batch full of intents whose delete persistently fails would delay newer ones (oldest first). Delete
  failures are expected to be transient; each pass logs them with intent ids, so it is visible.
- Cleanup is covered against PostgreSQL and a faked storage port in the worker, and the real S3 contract
  by conformance and the smoke script; there is no browser test, because eligibility is measured in hours.
- A stored object key that no longer parses would make the claim throw and roll back, halting cleanup
  (logged every pass). Keys are written only by the application and are always valid, so this is not
  expected; a per-row skip would need an extra state.
- Signed rendition URLs issued before an object is removed keep working until they expire (ADR-016).

## Verification evidence (final tree, 2026-10-09)

`env:check`, `format:check`, `typecheck`, `lint`, `test:unit`, `test:integration`, `test:coverage`,
`db:check`, and `build` all exit 0; `test:e2e` passed 125 tests (the worker, now running the cleanup loop,
is part of that run). Every file this task adds is at 100% lines, branches, functions, and statements. The
longest changed file is 241 lines.

## Review

Formal deep review (`deep-review-until-clean`) of the whole W3-07 diff: **Converged**. Methods used:
whole-file read (M1), producer/consumer check of the schema, policy, READMEs, and plan against code and a
real `EXPLAIN` (M4), mutation proof (M5), house-rule audit including an AST check for assertions, `unknown`,
and `any` and a file-length audit (M11), and execution-path reasoning for the claim/complete race (M3).
The final three passes, over an unchanged tree after the last fix, were coverage-hole walk (M6),
adversarial input enumeration (M8), and hunk narration (M2), and found nothing.
