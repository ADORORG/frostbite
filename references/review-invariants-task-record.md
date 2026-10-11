# W4-04 — No self-approval and approval/revocation concurrency invariants

Status: completed 2026-10-10; formal deep review Converged (see "Review")
Baseline: `9b1ae09` (W4-03b), branch `feat/w4-04-review-invariants`
Depends on: W4-03.

## Objective and done criteria

Nobody can approve their own collection, by any path, and an approval cannot be acted on after the
approver, the creator, or the approval itself has been withdrawn, even when the withdrawal and the
action race. Done means each rule holds in the database and is proven with a deterministic race, not a
timing hope.

## What was built

- Migration `20261010075232_collection_review_no_self_review`: a trigger on the review record refuses a
  decision event by the submission's creator and a submit event by anyone else.
- `@ador/collections`: the approved-version guard. `findApprovedVersion` (display, no lock) and
  `lockApprovedVersion` (acting: shared locks on the approved submission then the creator's
  application, so a revocation or suspension in flight waits and a committed one is seen). `isApprovedCreatorNow`
  is the lock-free creator check.
- `@ador/test-kit/race`: `holdTransaction` and `expectToWait`, replacing three hand-rolled copies.
- Tests: self-review through every decision and directly in the database; the approved-version rules for
  every state and every creator state; approval versus a creator suspension or revocation in flight,
  reviewer role withdrawal in flight, revocation versus an acting caller, and a concurrent mix with no
  deadlock; a feature-level check that a creator with the reviewer role is refused over HTTP.

## Decisions taken without the product owner (defaults, to be reviewed)

- "Approved" for display and action means the submission is approved and its creator is still approved.
- Rejection, suspension and revocation never need an approved creator.

## Review

| Pass | Method                         | Result                                                                                                                                                                              |
| ---- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | M1 whole-file read and M7 runs | My first race tests held the competing change outside the held transaction and passed or failed for the wrong reason; fixed, and the helper now releases the holder even on failure |
| 2    | M5 mutation proof              | 15 mutants over the guard, the creator check, the trigger clauses and the race helper; 1 survived and was dead code (an ordering the unique index makes pointless), removed         |
| 3    | M11 house rules (AST audit)    | Clean                                                                                                                                                                               |
| 4-6  | M1 re-read, M6 coverage, M7    | Zero findings and zero code edits on the final tree: **Converged**                                                                                                                  |

## Gates (final tree)

`env:check`, `format:check`, `typecheck`, `lint` (including the repository policy), `test:unit`,
`test:integration`, `test:coverage`, `db:check`, and the full `test:e2e` exit 0.

## Findings and limits

See `docs/session-findings.md` (W4-04 section, K1 to K8). K3 matters for Week 5: no production code calls
the lock yet, and every publication or deployment path must.
