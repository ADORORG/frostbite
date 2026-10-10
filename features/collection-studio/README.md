# Collection studio feature

Contributes the authenticated API for a creator's collection drafts (create, list, read, save, and
add, update, or remove items) and the resumable creator wizard that uses it. Registration receives
the platform provider registry and the enabled chains explicitly, so removing its one line detaches the
routes, pages, navigation entry, and their storage use.

## Pages

One page, one job (see `docs/product/journeys.md`): an overview, a create page, and a detail page.

| Page              | Path                      | Notes                                                                                                    |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Studio home       | `/studio`                 | Where the person stands as a creator, their collections by standing, their images, and the one next step |
| Collections       | `/studio/collections`     | Cards with standing, progress, and next action; filters by standing; "New collection"                    |
| New collection    | `/studio/collections/new` | One short form (name, supply, chain), with a way back                                                    |
| Collection wizard | `/studio/collections/:id` | Details, supply and chain, images, items, review; step lives in the URL hash                             |

The studio home and the collections pages read the caller's creator standing (the creator-admission
contract) and say why instead of offering a form that would be refused; if the standing cannot be read,
the server decides. Standing words and next steps are pure and tested (`src/client/creator-standing.ts`);
a collection's standing (draft, in review, needs changes, approved, closed) comes from the state of its
latest submission and is defined once in `@ador/shared/collections`.

All wizard state is server-side, so a creator resumes on the first unfinished step from any device.
Unsaved edits overlay the saved draft; a stale revision shows a conflict notice with a reload. Images
are chosen from the creator's processed library and uploaded in place: each image slot has an uploader
for its purpose (`@ador/feature-uploads/inline`), and a processed upload refreshes the library and is
chosen, so the creator never leaves the step. Nothing is published or sent to a chain, and the page says
so.

Layout: `src/client` (typed API client on `@repo/client-http`, form parsing, error copy, progress),
`src/ui/hooks`, `src/ui/components`, and the surface files that compose them.

| Operation               | Route                                    | Notes                                                                                    |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `createCollectionDraft` | `POST /api/v1/collection-drafts`         | Idempotency key required                                                                 |
| `listCollectionDrafts`  | `GET /api/v1/collection-drafts`          | The caller's own, newest first                                                           |
| `readCollectionDraft`   | `POST /api/v1/collection-drafts/read`    | Detail with signed previews; POST because the HTTP layer has no path or query parameters |
| `saveCollectionDraft`   | `PUT /api/v1/collection-drafts`          | Must name `expectedRevision`                                                             |
| `addCollectionItem`     | `POST /api/v1/collection-drafts/items`   | Idempotency key required                                                                 |
| `updateCollectionItem`  | `PUT /api/v1/collection-drafts/items`    |                                                                                          |
| `removeCollectionItem`  | `DELETE /api/v1/collection-drafts/items` | Removing what is gone succeeds                                                           |

| `submitCollection` | `POST /api/v1/collection-submissions` | Idempotency key required; names `expectedRevision` |
| `listCollectionSubmissions` | `POST /api/v1/collection-submissions/list` | The creator's own submissions with decisions |

Submitting freezes the collection (see `@ador/collections`). The wizard's review step shows what the collection still needs, offers "Submit for review" (or "Submit again" after changes were requested) only for the saved version, and shows each submission's state with its history: when it was submitted and what each decision was, with the
reviewers' feedback (never who decided or the private notes). Refusals:
not ready (400, naming what is missing), a stale revision, a submission already in review, or one closed
for good (409), another creator's collection (404), a creator no longer approved (403).

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
