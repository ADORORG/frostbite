# Collection studio feature

Contributes the authenticated API for a creator's collection drafts: create, list, read, save, and
add, update, or remove items. It adds no page yet (the creator wizard is W4-02). Registration receives
the platform provider registry and the enabled chains explicitly, so removing its one line detaches the
routes and their storage use.

| Operation               | Route                                    | Notes                                                                                    |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `createCollectionDraft` | `POST /api/v1/collection-drafts`         | Idempotency key required                                                                 |
| `listCollectionDrafts`  | `GET /api/v1/collection-drafts`          | The caller's own, newest first                                                           |
| `readCollectionDraft`   | `POST /api/v1/collection-drafts/read`    | Detail with signed previews; POST because the HTTP layer has no path or query parameters |
| `saveCollectionDraft`   | `PUT /api/v1/collection-drafts`          | Must name `expectedRevision`                                                             |
| `addCollectionItem`     | `POST /api/v1/collection-drafts/items`   | Idempotency key required                                                                 |
| `updateCollectionItem`  | `PUT /api/v1/collection-drafts/items`    |                                                                                          |
| `removeCollectionItem`  | `DELETE /api/v1/collection-drafts/items` | Removing what is gone succeeds                                                           |

Item operations return the collection's new `revision`, which the next draft save must name.

Persistence and rules are in `@ador/collections`; this feature validates input through
`@ador/shared/collections`, maps each outcome to one stable HTTP error, and presents records. Previews
come from the uploads library service (`getMany`), so image states and short-lived signed renditions
(ADR-016) are produced in one place. Signed URLs are bearer capabilities that expire; never store them.

Error mapping: `not-found` (including another creator's draft) is 404, `not-eligible` is 403,
an image that is not the creator's processed upload for that use, or an unavailable chain, is 400,
and a stale revision, an idempotency conflict, or a full collection is 409.

Run `env:check`, `typecheck`, `test:unit`, `test:integration`, or `test:coverage`. Platform engineering
owns this feature.
