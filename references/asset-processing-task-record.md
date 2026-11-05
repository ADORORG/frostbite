# W3-03 — Asset persistence and idempotent processing jobs

Status: converged
Baseline: `fb7dec3c2250cdf54b2e824965879c7090b9621c`
Baseline worktree: clean
Started: 2026-09-14

## Objective and done criteria

Complete an authorized upload intent by observing its private object, atomically creating one asset
record and one identifier-only processing event, and preserving PostgreSQL as workflow truth.

Done requires authenticated same-origin completion, exact observed-byte verification, owner and
expiry enforcement, idempotent duplicate completion, a transactional outbox event, explicit pending
processing state, provider-neutral storage identity, and positive, negative, concurrency, rollback,
and provider-failure tests. Completion must not claim media validation or publication.

## Approach

- Extend the storage port with validated provider identity so asset locators remain portable.
- Bind each intent to its issuing provider. The generated upgrade migration backfills existing
  intents to R2—the only provider previously able to issue them—then removes the temporary default.
- Keep object observation outside the database transaction, then re-check authority and expiry while
  locking the intent before atomically inserting the asset, completing the intent, and enqueueing the
  event.
- Use the upload intent as the natural idempotency boundary. Concurrent and repeated completions
  return the single persisted asset and never enqueue a second event.
- Keep Inngest types and delivery outside the feature. The existing outbox relay delivers the stable
  event later; acknowledgement is not processing completion.

## Deliberate boundaries and risks

- W3-04 owns signature, MIME, checksum, decoded-dimension, and terminal validation outcomes.
- W3-05 owns derivatives; W3-07 owns abandoned-object cleanup.
- A missing object or byte mismatch leaves the intent retryable until expiry. Storage failures remain
  retryable server errors and cannot mutate PostgreSQL state.
- Object observation can become stale between `HEAD` and transaction commit. The durable record stores
  the observation evidence; W3-04 must stream and revalidate the object before trusting it.

## Verification and convergence

- Full repository environment parity, formatting, lint, repository policy, TypeScript, Rust,
  production build, unit, integration, merged coverage, and Playwright gates passed.
- The upload package reported 98.86% statements, 95.65% branches, 100% functions, and 98.78% lines.
  The upload feature reported 100% in every coverage category, and merged line and branch coverage
  remained above 90%.
- Playwright reported 86 passed and 6 intentionally skipped tests across mobile, tablet, desktop,
  and wide viewports.
- Mutation checks proved that exact byte comparison, transactional event creation, provider binding,
  and the strict identifier-only processing payload are guarded by tests. Each deliberate defect
  produced the expected failure and was restored before the final gates.
- The production E2E gate exposed a broad database-barrel import that evaluated migration filesystem
  code in the standalone bundle. The repository now consumes an explicit `@frostbite/database/outbox`
  subpath; the rebuilt standalone app and all browser tests then passed.

The clean streak restarted after that repair:

| Pass | Method                                      | Result |
| ---- | ------------------------------------------- | ------ |
| 1    | M1 line-by-line control and data-flow trace | Clean  |
| 2    | M4 producer/consumer contract diff          | Clean  |
| 3    | M11 house-rule audit                        | Clean  |

Verdict: **Converged**. The final three independent passes found no new verified defect and changed
nothing. W3-04 may now consume only the pending asset and private-object evidence; it must independently
stream and validate the bytes before any asset can become trusted or published.
