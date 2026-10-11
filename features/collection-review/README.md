# Collection review feature

Staff review of collections that creators have submitted: the review queue, one submission in full (its
frozen snapshot with the creator's images, and every event including private notes), and decisions. It
contributes three API routes and two admin pages. Register `createCollectionReviewFeature` once in the
feature registry with the authorization policy and the provider registry; removing that line removes
every review route, page, and navigation entry.

| Operation                        | Route                                      | Notes                                                                   |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `listCollectionReviewActivity`   | `POST /api/v1/collection-reviews/activity` | Every event of every submission, newest first, in pages cut at a cursor |
| `listCollectionReviewQueue`      | `POST /api/v1/collection-reviews/queue`    | Chosen states, oldest update first                                      |
| `readCollectionReviewSubmission` | `POST /api/v1/collection-reviews/read`     | Snapshot, audit trail, and signed image previews                        |
| `decideCollectionReview`         | `POST /api/v1/collection-reviews/decide`   | Idempotency key required; answers without previews                      |

| Page                | Path                                       | Notes                                                                            |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Review queue        | `/admin/collection-reviews`                | Three groups: needs review, approved or paused, finished                         |
| Review activity     | `/admin/collection-activity`               | The audit log: who did what to which submission, when; older events a click away |
| Review a submission | `/admin/collection-reviews/[submissionId]` | The frozen version, the decision form, and the history                           |

Everything requires the `collection:review` capability, which the authorization policy grants to the
`reviewer` role (not to `staff`). The web route layer enforces it for the session; `decide` also checks,
inside its own transaction, that the reviewer's role is still active, that the reviewer is not the
creator, and that the transition is legal.

## Behaviour worth knowing

- The decision form offers only the moves the state machine allows from where the submission stands, and
  asks for a second click before rejecting or revoking. Feedback is required wherever the creator must be
  told why (request changes, reject, suspend, revoke).
- A decision's idempotency key is held until the decision is recorded and replaced when the decision
  changes, so a retry after a lost response cannot record it twice.
- Images are signed for the review only: the read operation signs just the assets frozen into that
  submission, as its creator's own, through the uploads library (ADR-016). Previews are never stored.
- The audit reason code is derived from the action (`client/decisions.ts`), not typed by the reviewer.

## Audit visibility

- **Staff** see the activity log (every submission and decision, newest first, with the actor's name, the
  reason code, and the state each event led to) and, on a submission, its full history with the same
  detail plus feedback and private notes, and the creator's standing now (an approval is refused for a
  creator who is not approved, and the page says so before the reviewer chooses). Events cannot be
  changed or removed (database triggers).
- The activity log carries no private notes and no feedback; those stay on the submission's own page.
- Pages are cut at the position of the last event seen (its time, then its id), so a page is stable while
  new events arrive and nothing is missed or repeated. The cursor is opaque and a forged one is refused.
- **Creators** see their own submission's history (when it was submitted and what each decision was,
  with the words written for them) in the wizard's review step, never who decided or the private notes.

## Structure

`src/application` (operations, presenters), `src/client` (typed API client on `@ador/client-http`, form
parsing, failure copy, queue groups), `src/ui` (hooks bound to `@ador/client-react`, components, and the
two page surfaces), `src/runtime.ts` (lazy service and preview resolvers over the uploads context).

Rules and persistence live in `@ador/collections`; contracts in `@ador/shared/collections`. Error mapping:
an unknown submission is 404, a reviewer without the role (or the creator themselves) is 403, an illegal
move, a creator who is no longer approved, or an idempotency conflict is 409.

Run `env:check`, `typecheck`, `test:unit`, `test:integration`, `test:coverage`, or the browser checks
(`tests/e2e`, `collections-review*.spec.ts`). Platform engineering owns this feature.
