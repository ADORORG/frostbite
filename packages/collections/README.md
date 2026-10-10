# `@ador/collections`

Creator-owned collection drafts: the draft record, its ordered items, and the rules that keep them
consistent. It owns persistence and invariants; HTTP and presentation belong to
`@ador/feature-collection-studio`. Nothing here is public, and nothing here is a deployment.

## Public API

- `createCollectionService` validates drafts and items with the shared schemas
  (`@ador/shared/collections`), checks the target chain against the enabled chains it was given, builds
  a fingerprint of each retryable request, and delegates to the repository port.
- `createDrizzleCollectionRepository` is the PostgreSQL adapter for `CollectionRepository`.
- `createSubmissionService` (creator: submit a collection for review, list its submissions) and
  `createReviewService` (staff: queue, read in full, decide) validate requests, derive the idempotency
  fingerprint (which includes the actor), and delegate to `SubmissionAuthoring` and `ReviewRepository`.
  `createDrizzleSubmissionRepository` implements both ports on PostgreSQL.
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
- Lock order, to be kept by anything that joins these transactions: the collection row first
  (`FOR UPDATE`), then the creator's application row (`FOR SHARE`). A decision locks the submission row
  first, then the reviewer's role assignment and the creator's application row (both `FOR SHARE`). The
  creator admission review locks only the application row, so none of these can deadlock while the
  order holds.
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

## Submissions and review

- **Submitting** freezes the collection as a new `collection_submissions` row in one transaction that
  holds the collection row: a snapshot of the draft, its items in order, and the SHA-256 content hash
  of every image, plus a hash of the whole snapshot. It must name the revision the creator last saw
  (`revision-conflict` otherwise), the creator must still be approved, the chain must still be offered,
  every image must still be the creator's processed upload for its purpose, and the collection must
  satisfy `missingSubmissionRequirements` (description, cover image, every planned item present).
- **Immutability is enforced by the database.** A trigger refuses any update to a submission except its
  review `state` and `updated_at`, and every delete; review events are append-only. Editing the draft
  afterwards never changes what was reviewed.
- **One live submission per collection** (a partial unique index). A new submission is possible only
  when the previous one ended in `changes-requested`; `rejected` and `revoked` close the collection for
  good (an approved version's later revision is a later task).
- **Review states** are in `@ador/shared/collections` (`resolveSubmissionTransition`): submitted,
  under-review, approved, changes-requested, rejected, suspended, revoked.
- **Deciding** checks, inside the decision's transaction: the reviewer holds an active reviewer role
  (shared lock, so a withdrawal waits), the reviewer is **not the creator**, the transition is legal, and
  for `approve` and `reinstate` the creator is still an approved creator. Rejection, suspension and
  revocation never need the creator to be approved.
- Retries are idempotent through the event's unique key (serialised with an advisory lock), and a key
  replayed with different content or by another actor is a `conflict`.
- The creator sees decisions and the feedback written for them; private notes, reviewer identity and
  reason codes stay with staff.

## The approved version, and what must hold when acting on it

- An **approved version** is a submission in the `approved` state **and** whose creator is still an
  approved creator. Either half failing means there is none, whatever the submission row says.
- `ApprovedVersionReader.findApprovedVersion` reads it without a lock, for display (public pages): the
  answer can be stale by the time it is used.
- `lockApprovedVersion(transaction, collectionId)` is for anything that **acts** on approval
  (publication, deployment). Call it inside the transaction that records the action. It takes shared
  locks on the approved submission and then on the creator's application, the order a decision uses, so
  a revocation, a suspension, or a withdrawal in flight waits until the caller commits, and one that
  already committed is seen (it returns null and the caller must not act).
- A decision (`approve`, `reinstate`) takes the same locks from the other side, so approval versus
  revocation is ordered by the database, never by luck. Lock order for the review path: the idempotency
  key, the submission row (`FOR UPDATE`), the reviewer's role assignment (`FOR SHARE`), the creator's
  application (`FOR SHARE`). A concurrency test runs mixed approvals, rejections, suspensions and
  revocations and requires no deadlock and a record consistent with the state.
- **Nobody reviews their own collection**: the repository refuses it, and a trigger on the review record
  independently refuses a decision event by the creator and a submit event by anyone else, so no path
  (a later role grant, a bug, a stray query) can record it.
- A rejection, suspension or revocation does not need the creator to be approved, so a suspended creator
  cannot hold a pending submission hostage.

## What this is not

A draft records the chain it **targets** (a CAIP-2 id, ADR-017). The adapter family and version are
recorded when a deployment binds a collection to a chain, which this package does not do. Approval
does not publish or deploy anything: publication and deployment are separate, later authorizations.

## Configuration

None of its own. The composition root supplies the clock, id source, list limit, the enabled chains,
and a database client. Limits are the shared engineering bounds in `@ador/shared/collections`.

## Tests

`pnpm test:unit` (service rules against a recording repository), `pnpm test:integration` (the adapter
against real PostgreSQL migrations, including concurrency), and `pnpm test:coverage`. Platform
engineering owns this package.
