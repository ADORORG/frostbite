# W4-03b — Creator submit controls and the staff review page

Status: completed 2026-10-10; formal deep review Converged (see "Review")
Baseline: `ae3f176` (W4-03), branch `feat/w4-03b-submission-ui`
Depends on: W4-03.

## Objective and done criteria

A creator can see what their collection still needs, submit the saved version for review, follow its
state with the reviewers' feedback, and submit again after changes were requested. A reviewer can work
a queue, read the frozen version with its art, and record a decision with the words the creator will
read. Done means both ran in real browsers on real services, with accessibility, keyboard, responsive,
reduced-motion, and visual coverage, and nothing here publishes or deploys anything.

## What was built

- Creator side (`@frostbite/feature-collection-studio`): the review step shows a readiness checklist, the
  newest submission's state in plain words with reviewer feedback, a warning when the draft has moved on
  since the submitted version, and one submit control that only submits the saved version.
  `useSubmissions` holds the idempotency key until a submission succeeds and replaces it when the
  revision changes. Client rules: `submission-progress.ts` and `submission-copy.ts`.
- Staff side (`@frostbite/feature-collection-review`, now a UI feature): `/admin/collection-reviews` (queue
  in three groups) and `/admin/collection-reviews/[submissionId]` (the frozen version with images, the
  decision form, the history). The read operation returns signed previews of the submission's own images.
- `@frostbite/client-react` (new): `useResource` and `useAction`, extracted so features share one
  implementation; the studio now uses them.
- `@frostbite/feature-uploads/context`: the one database-and-storage context resolver, replacing copies.
- `@repo/ui`: radio and checkbox labels lay out beside their control (radios had been full-width), and
  `.arcade-facts` for label and value lists.
- Shared: staff routes and labels (`submissionStateLabels`, `reviewActionLabels`), the detail response
  with previews, page paths, and the navigation label. Test fixtures: `libraryAssetFixture`.
- Browser coverage: a serial journey (submit, changes requested, resubmit, approve, non-reviewers
  refused) and a quality matrix for five states across four viewports.

## Decisions taken without the product owner (defaults, to be reviewed)

- Reviewers see a submission's images through signed previews limited to that submission's assets.
- The audit reason code is derived from the action; reviewers type only feedback and private notes.
- Rejecting or revoking asks for a second click; other decisions do not.
- The queue is read in three groups, oldest update first, up to 100 at a time.

## Review

| Pass | Method                       | Result                                                                                                                                                                                                             |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | M7 browser and visual review | Radios rendered as wide empty boxes and the facts list collapsed on phones; fixed and re-baselined                                                                                                                 |
| 2    | M5 mutation proof            | 35 mutants; 5 survived: a key-release gap in the creator hook, a stale chosen move after a reload, a mutant string that no longer matched (re-run and killed), and one equivalent survivor; tests added and re-run |
| 3    | M11 house rules (AST audit)  | Two assertions in test code removed; the remaining `unknown` uses are catch and describe boundaries, documented                                                                                                    |
| 4    | M4 contract diff             | Every mocked body in the visual spec is parsed by the shared contract; the journey and integration tests parse real responses                                                                                      |
| 5-7  | M1 re-read, M6 coverage, M7  | Zero findings and zero code edits on the final tree: **Converged**                                                                                                                                                 |

## Gates (final tree)

`env:check`, `format:check`, `typecheck`, `lint` (including the repository policy), `test:unit`,
`test:integration`, `test:coverage`, `db:check`, and the full `test:e2e` exit 0. File lengths are within 300.

## Findings and limits

See `docs/session-findings.md` (W4-03b section, J1 to J12).
