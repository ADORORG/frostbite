# UX-2 task record: the studio flow

Branch `feat/studio-flow`, stacked on `feat/studio-journey`. Baseline: `392a216` (UX-3 navigation).

## Built

- **Standing**: a collection's list entry carries the state of its latest submission; the five standings
  (draft, in review, needs changes, approved, closed) and their words are defined once in
  `@frostbite/shared/collections` (`standing.ts`).
- **Overview and create are separate pages**: `/studio/collections` is cards with filters by standing and
  counts, next action per card, and an empty state; `/studio/collections/new` is one short form with a way
  back. New design-system pieces: filter tabs, empty state, card, callout, disclosure styles.
- **Images upload in place**: each image slot in the wizard has a fixed-purpose uploader
  (`@frostbite/feature-uploads/inline`); a processed upload refetches the library, puts it in place, and
  chooses the new image. The uploads page offers "Use it in a collection" after a processed upload.
- **Studio home** (`/studio`, moved from the accounts feature to the studio feature): where the person
  stands as a creator, collections by standing, images, and one next step.
- **Approval gating**: people who cannot build collections are told why and where to go (never applied,
  draft, submitted, in review, changes requested, rejected, suspended, revoked) instead of a form that is
  refused. If the standing cannot be read the form stays and the server decides.
- **Shell**: `overflow: hidden` no longer disables the sticky header and sidebar; screenshots freeze both.

## Evidence

- Final gate run on this tree and mutation results: see the commit message.
- 27 + 2 mutations over the standing mapping, filters, next-step rules, API mapping, hook, gating, upload
  ordering and reporting, summary arithmetic, and progress; two survivors led to new tests (a failed
  refresh keeps the last known standing; the card's progress value), a third (an empty-list guard) was
  dead code and was removed.
- Real browser: cover uploaded and chosen inside the wizard on real storage and a worker, saved, and
  listed on the overview as a draft card.
- Screenshots read before baselines were accepted: studio home (desktop, mobile), collections overview
  (desktop), new collection (mobile).

## Audit findings repaired

1. A list-query guard that changed nothing (dead code) removed.
2. Tests for a failed standing refresh and for the progress bar's value (survived mutation).
3. An unchecked type assertion in a test fake, replaced by a typed state.
4. A quality fixture (`collectionQualityList`) that was never an approved creator; gated pages correctly
   showed it the approval notice.
5. Full-page screenshots drew the now-sticky header and sidebar displaced; frozen for screenshots.

## Later increments (UX-2 remainder)

- Closed standing split into Paused and Ended; uploads split into a library, an add page and an image page;
  `/admin` is an overview of the staff areas a person may open; the creator application has a status card
  and is read-only once sent; the review detail reads in plain words; collection cards show the chosen cover.
- One shared `PageFrame` replaced three near-identical page frames; one shared creator-standing copy (words,
  colour, badge) replaced two.

## Convergence review (UX-2 and UX-3, 2026-10-10 to 11)

Scope: `392a216~1` to the working tree, about 175 files. Verdict: **Converged**.

| Pass | Method                                               | Result                                                                                    |
| ---- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | M1 whole-file read of every production file          | duplicated paths and wording, a dead branch, a wrong link: repaired                       |
| 2    | M4 producer/consumer diff, with a read of every test | vacuous and flaky tests, a coverage gap, stale wording: repaired                          |
| 3    | M11 house rules, rule by rule                        | generated lockfile reformatted by my formatter (restored), one undocumented `unknown`     |
| -    | M5 mutation proofs throughout                        | every new or changed test proven; survivors fixed with tests, or recorded as copy wording |
| -    | M6 coverage walk, M8 adversarial inputs              | eight untested branches covered; an emoji monogram bug fixed                              |
| -    | M9 siblings                                          | a third copy of the page frame and a duplicated badge wording merged                      |
| A    | M10 dead-code proof                                  | clean: no new symbol unreferenced                                                         |
| B    | M6 coverage holes (dynamic, with the full e2e run)   | clean: two documented, proven-unreachable fallbacks                                       |
| C    | M9 convention conformance                            | clean                                                                                     |

Final gates on the committed tree: env:check, format:check, typecheck, lint, repository:check,
test:unit, test:integration, test:coverage, db:check, test:e2e all pass (217 e2e passed, 6 skipped).
Lowest workspace coverage 95.4% statements, 91.2% branches, 96.5% functions, 96.6% lines. Longest file 285
lines. `pnpm-lock.yaml` identical to the baseline.

Findings log: `docs/session-findings.md` S12. Not fixed, filed as tasks: applicant cannot see the reviewer's
feedback; creator review needs a list of applications (filter and sort); a layout gap on narrow screens.

## Left open

Layout and density (UX-4) and click-only journeys for every role (UX-5) follow; the preview waits for them and
for a manual walk by the product owner.
