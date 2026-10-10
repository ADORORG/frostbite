# Collection review feature

Staff review of collections that creators have submitted: the review queue, one submission in full
(its frozen snapshot and every event, including private notes), and decisions. It contributes API
routes only for now; the review page is a later task. Register `createCollectionReviewFeature` once in
the feature registry with the authorization policy; removing that line removes every review route.

| Operation                        | Route                                    | Notes                              |
| -------------------------------- | ---------------------------------------- | ---------------------------------- |
| `listCollectionReviewQueue`      | `POST /api/v1/collection-reviews/queue`  | Chosen states, oldest update first |
| `readCollectionReviewSubmission` | `POST /api/v1/collection-reviews/read`   | Snapshot and the full audit trail  |
| `decideCollectionReview`         | `POST /api/v1/collection-reviews/decide` | Idempotency key required           |

Every operation requires the `collection:review` capability, which the authorization policy grants to
the `reviewer` role (not to `staff`). The web route layer enforces it for the session; `decide` also
checks, inside its own transaction, that the reviewer's role is still active, that the reviewer is not
the creator, and that the transition is legal.

Rules and persistence live in `@ador/collections`; contracts in `@ador/shared/collections`. A
decision that needs the creator to know why (request changes, reject, suspend, revoke) must carry
feedback. Error mapping: an unknown submission is 404, a reviewer without the role (or the creator
themselves) is 403, an illegal move, a creator who is no longer approved, or an idempotency conflict is 409.

Run `env:check`, `typecheck`, `test:unit`, `test:integration`, or `test:coverage`. Platform engineering
owns this feature.
