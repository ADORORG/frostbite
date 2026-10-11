# Applicant feedback task record

Task: show the reviewer's feedback to a creator applicant (found in the UX-2/UX-3 convergence review, S12).

Baseline: `ec72835` (branch `feat/applicant-feedback`, stacked on `feat/studio-flow`).

## What was built

- **Contract.** The applicant's view of an application (`creatorApplicationViewSchema`) carries
  `feedback`: the latest message a reviewer wrote for the creator (`createdAt`, `text`), or null. The private
  notes and evidence are not part of it. `creatorReviewActions` is now one list shared by the decision schema
  and the query.
- **Repository.** `applicationView` reads the newest non-empty `creatorFeedback` among the reviewer's own events
  (action filter enforced in the query, ties broken by event id); every path that returns an application
  (find, save, submit, review, replay) includes it. `review` moved to `drizzle-review.ts` (the repository file
  was over the 250-line warning).
- **API and page.** `presentApplication` turns dates into text for the API and the server-rendered page.
- **UI.** A "Message from a reviewer" panel sits between the status card and the form while the application is
  changes-requested, rejected, suspended or revoked; hidden otherwise (an old message against a new submission
  would mislead). Shown as plain text with line breaks kept.
- **E2E.** The creator-admission journey now includes request-changes, the applicant reading the message,
  correcting and resubmitting, and approval; a seeded applicant (with a private note that must not appear) has
  baselines on four viewports.

## Evidence

- Gates: env:check, format:check, typecheck, lint, repository:check, test:unit, test:integration,
  test:coverage, db:check, test:e2e all pass (221 e2e passed, 6 skipped). Lowest workspace coverage
  95.5% / 91.4% / 96.5% / 96.6%. Longest changed file 261 lines.
- Mutations: every new test proven; one survivor (the id tie-break) is justified: Postgres leaves tie order
  unspecified, so no data can force the difference; the test shows the intended answer.
- Review: M1 whole-file read found the tie and the reliance on "applicant events have no text" (both
  repaired); M4 found a stale fixture in the studio's API client test; M6 found two untested branches
  (covered); a flaky test of mine (UUIDv7 ids in the same millisecond are not ordered) was fixed. Clean passes:
  M10, M6, M9. Verdict **Converged**.
