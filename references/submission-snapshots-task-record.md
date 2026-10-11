# W4-03 — Immutable submission snapshots and review state transitions

Status: completed 2026-10-10; formal deep review Converged (see "Review")
Baseline: `dfb5221` (W4-02), branch `feat/w4-03-submission-snapshots`
Depends on: W4-01 and staff authorization (the `reviewer` platform role).

## Objective and done criteria

A creator can freeze a ready collection as a submission; staff can find it, read it in full, and take it
through review (start review, approve, request changes, reject, suspend, reinstate, revoke) with a reason
the creator can read; and what was reviewed can never change, whatever happens to the draft afterwards.
Done means the rules hold in the database and in the transaction that records each decision, and the
whole path ran on real PostgreSQL. No page is delivered here (see W4-03b), and nothing is published or
deployed.

## What was built

- `@ador/shared/collections`: the submission state machine (one exhaustive transition table), the
  `collection:review` capability name, the review decision schema (feedback is required wherever the
  creator must be told why), the frozen snapshot schema, readiness rules, and the HTTP contracts for
  creators and staff.
- Database (migration `20261010054537_black_skin`): `collection_submissions` (frozen snapshot, hash, one
  state, one live submission per collection by partial unique index) and `collection_review_events`
  (append-only). Hand-written triggers make a submission immutable apart from its state and update time,
  forbid deletes, and make events append-only.
- `@ador/collections`: `createSubmissionService` and `createReviewService` over two ports
  (`SubmissionAuthoring`, `ReviewRepository`) and one PostgreSQL adapter.
- `@ador/authorization/role-guard`: `holdsActivePlatformRole`, a shared-lock role check for domain
  transactions.
- `@ador/feature-collection-studio`: `submitCollection` and `listCollectionSubmissions`.
- `@ador/feature-collection-review` (new, API only): the review queue, a submission in full, and decide.
- Smaller: `@ador/http/outcome` (shared failure helper), `seedReadyCollection` and `seedPlatformUser`
  test fixtures, a repository-policy rule against runtime imports of the database package root.

## Decisions taken without the product owner (defaults, to be reviewed)

- Readiness: a description, a cover image, and every planned item present.
- A new submission only after `changes-requested`; `rejected` and `revoked` close the collection.
- The draft stays editable after submission; the snapshot is independent of it.
- `collection:review` is granted to `reviewer` only.
- Staff and creator pages are split into W4-03b.

## Review

| Pass | Method                            | Result                                                                                                                                                                                                                                       |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | M1 whole-file read                | Policy-version CHECK pinned a constant (would break a policy bump): relaxed and regenerated                                                                                                                                                  |
| 2    | M7 gates (first runs)             | Runtime import of the database root crashed the bundled server (e2e): fixed and a policy rule added; migration races in two test suites; four home baselines regenerated for the feature count; a coverage gap closed with two refusal tests |
| 3    | M5 mutation proof                 | 46 mutants; 11 survived: 2 were killed by suites I had not included, 9 were real gaps (replay by another collection, key serialisation, row lock, tie-breaks, snapshot order, creator feedback, conflict copy). All killed after new tests   |
| 4    | M11 house rules (AST audit)       | One assertion and one `unknown` in test code removed                                                                                                                                                                                         |
| 5    | M4 contract diff                  | Every operation's response is parsed by its shared schema in integration tests; error mapping matches the HTTP enum                                                                                                                          |
| 6-8  | M1 re-read, M6 coverage, M7 gates | Zero findings and zero code edits on the final tree: **Converged**                                                                                                                                                                           |

## Gates (final tree)

See the final run recorded in the session ledger: `env:check`, `format:check`, `typecheck`, `lint`
(including the repository policy), `test:unit`, `test:integration`, `test:coverage`, `db:check`, and the
full `test:e2e` exit 0. The one unreached branch in the review feature is the framework-guaranteed
idempotency-key guard.

## Findings and limits

See `docs/session-findings.md` (W4-03 section, I1 to I16).
