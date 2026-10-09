# `@ador/collections`

Creator-owned collection drafts: the draft record, its ordered items, and the rules that keep them
consistent. It owns persistence and invariants; HTTP and presentation belong to
`@ador/feature-collection-studio`. Nothing here is public, and nothing here is a deployment.

## Public API

- `createCollectionService` validates drafts and items with the shared schemas
  (`@ador/shared/collections`), checks the target chain against the enabled chains it was given, builds
  a fingerprint of each retryable request, and delegates to the repository port.
- `createDrizzleCollectionRepository` is the PostgreSQL adapter for `CollectionRepository`.
- Result types (`CreateResult`, `SaveResult`, `AddItemResult`, ...) are discriminated unions: every
  expected failure is a value, not an exception.

## Invariants

- Only an **approved creator** (creator application in state `approved`) may create or change a draft.
  The check runs inside each mutation's transaction and holds a shared lock on the application row, so a
  suspension or revocation in flight makes the change wait and is then seen: it cannot slip past. Reading a draft needs no approval.
- A draft belongs to one creator. Another creator's draft, or an unknown id, is `not-found` for every
  operation: existence is never disclosed.
- Every mutation locks the collection row, so item changes and draft saves of one collection are
  serialised. `revision` rises by one on every change to the draft **or** its items; a save must name
  the revision it was based on, and a stale one is `revision-conflict` and changes nothing.
- Lock order, to be kept by anything that joins these transactions (such as submission in W4-03): the
  collection row first (`FOR UPDATE`), then the creator's application row (`FOR SHARE`). The creator
  admission review locks only the application row, so the two cannot deadlock while this order holds.
- A referenced image (cover, banner, item image) must be a **processed** asset of the same creator,
  uploaded for the matching purpose. Someone else's asset, an unprocessed one, one made for another
  purpose, and a missing one are all reported as the same `invalid-asset`.
- Items never exceed the planned supply or the per-collection item limit, under concurrency; a save
  cannot lower the planned supply below the items already added.
- Retries are idempotent: creating a draft is keyed per creator and adding an item per collection, and
  the same key with different content is a `conflict`. A replay of a create returns the draft as it is
  now (it may have been edited since); a replay of an item add returns the stored item. The window
  of an item add ends when that item is removed.
- Item positions only grow, so removing an item leaves a gap instead of renumbering; removing what is
  already gone succeeds and changes nothing.
- The stored limits (name length, supply range, CAIP-2 chain id, positive revision and position) are
  also database CHECK constraints.

## What this is not

A draft records the chain it **targets** (a CAIP-2 id, ADR-017). The adapter family and version are
recorded when a deployment binds a collection to a chain, which this package does not do. Frozen,
reviewable copies and review states arrive with W4-03.

## Configuration

None of its own. The composition root supplies the clock, id source, list limit, the enabled chains,
and a database client. Limits are the shared engineering bounds in `@ador/shared/collections`.

## Tests

`pnpm test:unit` (service rules against a recording repository), `pnpm test:integration` (the adapter
against real PostgreSQL migrations, including concurrency), and `pnpm test:coverage`. Platform
engineering owns this package.
