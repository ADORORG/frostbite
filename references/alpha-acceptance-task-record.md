# W4-07 Internal-alpha workflow and Week 4 acceptance gate

Baseline: `14d4f62` on `feat/w4-07-alpha-gate`.

## Gate criteria and evidence

| Gate criterion (`docs/milestones/launchpad-beta.md`, Week 4)                                                                                      | Evidence                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An approved creator can authenticate, upload art, create a collection, leave and resume, submit it, and receive an approval or a revision request | `tests/e2e/tests/alpha-acceptance.spec.ts` walks it in real browsers on real storage, worker and database: images uploaded with names, collection built in the wizard, items and traits added from a CSV, leave and resume on the review step, submit, a reviewer's request for changes read by the creator, submit again, approval |
| Editing after submission cannot alter the reviewed snapshot                                                                                       | The same spec renames an item after submitting: the reviewer's frozen version still shows the old name; after approval a further edit changes the draft only and the public page shows the approved version. Database-level: `packages/collections/test/immutability.integration.test.ts` (direct writes refused)                   |
| Approval/revocation races cannot publish or deploy an unauthorized version                                                                        | `eligibility-race.integration.test.ts`, `review-races.integration.test.ts`, `self-review.integration.test.ts` (waits, refusals, no deadlock, no self-approval)                                                                                                                                                                      |
| No chain deployment is represented as completed                                                                                                   | The spec asserts the approved collection reads "Not yet minted" and the page has no deployed/live/contract-address wording; staff pages carry "Nothing published" and "No chain action"                                                                                                                                             |

## Dynamic proof the new spec can fail

The snapshot builder was changed to append text to item names; the spec's frozen-version assertion failed
("not edited after" received the text). The source was restored and the spec passes.

## Not covered by this task

Real approval/revocation races are proven in the integration suites, not in a browser. Chain deployment,
launches and pricing are outside Week 4 (see `docs/product/launch-brief.md`).
