# W4-06 — Creator and staff audit visibility

Status: completed 2026-10-10; formal deep review Converged (see "Review")
Baseline: `c5df436` (W4-05), branch `feat/w4-06-audit-visibility`
Depends on: W4-03.

## Objective and done criteria

Staff can see who did what to which submission and when, across every submission and within one;
creators can see what happened to their own submission and when, without learning who decided or reading
private notes. Done means the views are backed by the append-only record, paged stably, and checked in
real browsers with accessibility, keyboard, responsive, and visual coverage.

## What was built

- Staff activity log: `listCollectionReviewActivity` (`POST /api/v1/collection-reviews/activity`) and the
  page `/admin/collection-activity`: every event newest first as a sentence, the state it led to, the
  reason code, a link to the submission, and older events a click away. Pages are cut at the last event
  seen (time, then id); the cursor is opaque and a forged one is refused. No notes or feedback in the log.
- Submission page: events name who acted (with the id), and the creator's standing now is shown before
  the decision, with a warning when an approval would be refused.
- Creator history: the review step shows when the collection was submitted and each decision with its
  date and the words written for the creator.
- Shared: activity contracts and the cursor codec, past-tense action phrases, a standing field on the
  staff submission view.
- Browser coverage: the journey spec checks the real log and the creator's history (and that no reviewer
  name reaches the creator); a quality matrix covers the log (full with older events, and empty).

## Decisions taken without the product owner (defaults, to be reviewed)

- The log is collection-review events only; creator-admission and account audit have their own pages.
- Creators see dates and words, never reviewer identity; reviewers see names.
- Audit events are kept forever, with no search or export yet.

## Review

| Pass | Method                       | Result                                                                                                                                                                                                                                        |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | M5 mutation proof            | 22 mutants; 4 survived: one was a test edit that had never landed (re-added, then killed), one a mutant string that no longer matched (re-run, killed), and two were redundant code (a cursor length guard, a reload reset) that were removed |
| 2    | M11 house rules (AST audit)  | Clean                                                                                                                                                                                                                                         |
| 3    | M7 browser and visual review | The log page and the updated staff pages were read at four viewports; baselines for the queue and detail pages were regenerated for the new link and standing lamp                                                                            |
| 4-6  | M1 re-read, M6 coverage, M7  | Zero findings and zero code edits on the final tree: **Converged**                                                                                                                                                                            |

## Gates (final tree)

`env:check`, `format:check`, `typecheck`, `lint` (including the repository policy), `test:unit`,
`test:integration`, `test:coverage`, `db:check`, and the full `test:e2e` exit 0.

## Findings and limits

See `docs/session-findings.md` (W4-06 section, M1 to M8). M5 to M7 are product decisions.
