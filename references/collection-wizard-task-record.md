# W4-02 — Resumable creator collection wizard

Status: completed 2026-10-10; formal deep review Converged (see "Review")
Baseline: `8fdd49f` (W4-01), branch `feat/w4-02-collection-wizard`
Depends on: W4-01.

## Objective and done criteria

An approved creator can list their drafts, start one, and walk it through details, supply and chain,
images, items, and review, leaving and returning on any device and resuming where the draft stands. A
draft that changed elsewhere is reported, never silently overwritten. Nothing is submitted, published, or
sent to a chain, and the page says so. Done means the whole path ran in a real browser against real
services, with accessibility, keyboard, responsive, and visual coverage.

## What was built

- `@ador/client-http` (new): the browser requester (`createRequester`, `ApiError`, retry classification),
  extracted from the uploads feature, which now uses it. A real-socket integration suite proves the wire
  behaviour.
- `@repo/ui`: `ArcadeTextField` (label, hint, error, multiline) and step-list and choice-group styles.
- `@ador/test-kit/dom`: shared jsdom helpers (moved from the uploads tests).
- `@ador/shared/collections`: page paths, the wizard link helper, and the navigation label.
- `@ador/feature-collection-studio`: two authenticated pages (list at `/studio/collections`, wizard at
  `/studio/collections/:collectionId`), a "My collections" navigation entry, and the client layer
  (typed API client, form parsing, progress rules, error copy), hooks, and components.
- Playwright: wizard journey (create, resume, items, stale-draft conflict), and the experience-quality
  matrix (axe, keyboard, four viewports, visual baselines) for the list and wizard pages.

## Decisions taken without the product owner (defaults, to be reviewed)

- All state is server-side; the first open step is computed from the draft; the step lives in the URL hash.
- Unsaved edits are held per changed field over the saved draft; leaving the page with unsaved edits asks.
- Images are chosen from the creator's processed library; uploading stays on the uploads page.
- The wizard asks for a description, a cover image, and at least one item as prompts only. What submission
  requires is decided in W4-03.
- The review step states that submission is not available; no placeholder button.

## Review

| Pass | Method                                | Result                                                                                                                                                                                                                               |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | M1 whole-file read                    | One real defect: after a "changed elsewhere" reload, the form kept a full snapshot and a later save overwrote the other device's values for untouched fields. Fixed (changed-fields-only edits) with a regression test written first |
| 2    | M4 contract diff                      | Error codes, routes, and schemas agree with the producers                                                                                                                                                                            |
| 3    | M5 mutation proof                     | 43 mutants; 14 survived: 5 equivalent or dead code (removed or simplified), 1 killed by another suite, 8 real test gaps closed with new tests; the retargeted mutants were then all killed                                           |
| 4    | M11 house rules (AST audit)           | Three assertions in test code removed; two `unknown` catch-boundary uses documented                                                                                                                                                  |
| 5    | M6 coverage walk                      | One reachable gap (library load failure) closed with a test and a mutation proof; one unreachable branch recorded                                                                                                                    |
| 6-8  | M1 re-read, M7 full gates, M6 figures | Zero findings and zero code edits on the final tree: **Converged**                                                                                                                                                                   |

## Gates (final tree)

`env:check`, `format:check`, `typecheck`, `lint` (including the repository policy), `test:unit`,
`test:integration`, `test:coverage` (merged thresholds pass), `db:check`, and the full `test:e2e` (144
tests) exit 0. Coverage: `@ador/feature-collection-studio` 99.7 % lines and 97.9 % branches,
`@ador/client-http` and `@repo/ui` 100 %; the one unreached branch is the "no next step" arm on a saving
step, impossible by construction.

## Findings and limits

See `docs/session-findings.md` (W4-02 section, H1 to H11).
