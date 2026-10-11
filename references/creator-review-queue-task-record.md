# Creator review queue task record

Task: list creator applications for staff, filterable and sortable, instead of asking for a typed UUID (#30).

Baseline: `12e1dd0` (branch `feat/creator-review-queue`, stacked on `feat/applicant-feedback`).

## What was built

- **Contract** (`@ador/shared/creator-admission/review-queue.ts`): groups (all, needs review, approved or paused,
  finished) with their states, three sorts (oldest, newest, name), UTF-8 safe opaque keyset cursor, queue and read
  schemas, label maps, two routes (`review-queue`, `review-read`) and the detail page path.
- **Repository + service**: `listForReview` (latest submission per application, text keyset `(key, id)`
  comparison, millisecond-truncated time keys so cursor and rows agree), `countsForReview` (only applications that
  were ever sent), `readForReview` (frozen version plus the whole history with actor names, private notes included
  for staff). The service fetches one extra row to know whether another page exists.
- **HTTP**: two `creator:review` operations; a cursor the list did not produce is refused; an anonymous actor is refused.
- **UI**: queue page (group chips with counts, sort, cards with a way in, load more, loading/empty/error states) and
  detail page (what the applicant sent, only the decisions the state allows with the usual reason prefilled, history).
  Browser code uses an injectable API client that validates every response against the shared schema.
- **E2E**: the journey now finds the application in the list and opens it (no typed id), decides, and sees the history;
  baselines on four viewports for the populated queue, the empty queue and an application under review.

## Evidence

- Gates: env:check, format:check, typecheck, lint, repository:check, test:unit, test:integration, test:coverage,
  db:check pass. test:e2e: 228 passed, 6 skipped, **1 failed in three full runs under machine load** (`public-collection-card`,
  wide, 37 px at a badge edge; passes alone, in a subset, and passed in an earlier full run; unrelated files; logged
  in S13 as a flaky baseline needing an owner). Coverage: creator-admission feature 97.7 / 92.7 / 97.4 / 98.0,
  creator-admission package 96.6 / 92.8 / 100 / 100, shared 99.6 / 98.5 / 98.1 / 99.6. Longest changed file 300 lines.
- Mutations: 15 killed (case-insensitive name key, counts filter, next-page detection, cursor refusal, actor check,
  legal-only decisions, stale pages across groups, private notes in history, failure copy, chip counts, reload after
  a decision, empty-vs-loading, UTF-8 cursor, NUL key, key limit). One equivalent survivor (strict UTF-8 decode,
  unobservable) removed instead.
- Review: M1 found the non-Latin-1 cursor crash and the NUL key; M5 found the vacuous collation test (twice); M10 found
  three dead items; M11 found over-limit files and a duplicated helper. Clean passes after the last change: M10, M5,
  M11 (M4 clean earlier on the same code). Verdict **Converged** for the code; the full e2e gate is not green because
  of the flake above, which is stated rather than hidden.
