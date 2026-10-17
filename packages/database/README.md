# `@ador/database`

Server-only, provider-neutral PostgreSQL infrastructure for the platform.

## Public API

- Strict database environment parsing and migration URL fallback.
- Standard `pg` pool construction with explicit TLS and timeout policy.
- Drizzle client construction and explicit migration application.
- The shared `ador` PostgreSQL schema boundary.
- UUIDv7 auth user, wallet identity, challenge, and hashed-session tables.
- `released_wallets`: a wallet an account removed, held until a time so another account cannot take it at once.
- Durable upload-intent and private asset-observation tables with explicit processing state.
- Collection drafts (`collections`) and their ordered items (`collection_items`): a revision counter bumped
  by every change, a CAIP-2 target chain id, per-creator and per-collection idempotency keys, and CHECK
  constraints for the stored limits. `createDatabaseFromEnvironment` builds a client from validated
  configuration for composition roots.
- Collection submissions (`collection_submissions`) and their review events
  (`collection_review_events`): a frozen snapshot with its hash, one review state, at most one live
  submission per collection, and an append-only event record. Hand-written triggers in the migration
  make a submission immutable (only its state and update time may change, nothing is deleted) and
  events append-only, and a second trigger refuses a decision event by the creator or a submit event by anyone
  else; drizzle-kit does not model triggers, so they live in the SQL migrations.
- Transactional outbox insertion, lease-based claiming, acknowledgement, retry, and exhausted
  failure transitions.

Feature repository ports remain owned by their features. This package will provide their Drizzle
adapters as domain tables are accepted; it never exports database rows as HTTP contracts.

## Portability and invariants

- Requires standard PostgreSQL 18; no Railway or Supabase SDK is imported.
- Production changes use reviewed generated migrations. Schema push is not exposed.
- Migrations run as an explicit deployment step, never on application startup.
- Outbox rows preserve event identity across at-least-once delivery attempts. Concurrent relays use
  PostgreSQL row locks and expiring leases; stale workers cannot acknowledge another lease.
- `DATABASE_MIGRATION_URL` falls back to `DATABASE_URL` only when it is absent or blank.
- TLS, pool sizing, and timeouts come only from validated configuration.
- Public identifiers are application-generated UUIDv7 values stored in native `uuid` columns.
- Wallet challenges are single-use records; session storage contains hashes rather than bearer
  tokens and separately models idle expiry, absolute expiry, and revocation.
- One upload intent can create at most one asset. Provider identity, private key, measured metadata,
  and pending-validation state are persisted without storing temporary upload URLs.
- An asset's byte-validation outcome (W3-04) is a terminal `validated` or `rejected` state. The
  `assets_validation_coherent` CHECK ties each state to exactly its required fields (hash, detected
  type, dimensions, validator version, and entity tag for `validated`; a reason code only for
  `rejected`). Every required field is tested `IS NOT NULL` because a CHECK accepts UNKNOWN.
- An upload intent ends `completed` (it has an asset) or, if never completed and past its cleanup
  time, `abandoned` (W3-07). `object_removed_at` records that its private object was removed and may be
  set only on an abandoned intent (`upload_intents_removal_requires_abandoned`). The partial index
  `upload_intents_cleanup_idx` serves the cleanup sweep.
- The W3-03 expand migration backfills pre-existing intents to `r2-object-storage`, the only adapter
  that could issue them, then removes that temporary default so all new writes remain explicit.

## Verification

`test:integration` and `test:coverage` start a disposable `postgres:18.6-alpine` container, apply
the committed migration to an empty database, exercise constraints and rollback, then remove the
container. Docker is therefore required for these commands.

```bash
pnpm --filter @ador/database env:check
pnpm --filter @ador/database migration:check
pnpm --filter @ador/database migration:apply
pnpm --filter @ador/database typecheck
pnpm --filter @ador/database test:unit
pnpm --filter @ador/database test:integration
pnpm --filter @ador/database test:coverage
```

## Game contracts

`ador.published_templates` and `ador.game_contracts` record where each template and each game's contract is on a chain, written in the
transaction that completes the step that made it (`@ador/database/game-contracts`: `ContractStore` to read, `writeRecording` to write). A
record is never updated: the tables refuse a second record for a template or game, and two at one address. `ador.game_admin_steps`
is the evidence each points to, and may not be deleted while a record does.
