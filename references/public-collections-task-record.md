# W4-05 — Approved public collection list and detail pages

Status: completed 2026-10-10; formal deep review Converged (see "Review")
Baseline: `b9e409d` (W4-04), branch `feat/w4-05-public-collections`
Depends on: W4-03.

## Objective and done criteria

Anyone can browse the collections that passed review and open each one, and sees exactly the version
that was approved. Nothing that is not approved is shown or hinted at, nothing private reaches a page,
approval is never presented as a launch, and a catalog that cannot be read is never shown as empty.

## What was built

- `@ador/collections`: `ApprovedVersionReader.listApprovedCollections` lists collections that currently
  have an approved version (approved submission and still-approved creator), newest approval first,
  reading each from its snapshot in SQL.
- `@ador/feature-public-collections` (new): the list at `/collections` and a page at `/collections/[slug]`
  (the slug is the collection id), as server components with no client JavaScript. An explicit
  allowlist (`public-model.ts`) copies every public field; images are the creator's processed derivatives
  signed for display, limited to assets frozen into the approved version.
- The placeholder "collections" catalog in `public-products` is replaced; the registry order and the
  public navigation are unchanged.
- Browser coverage: the journey spec proves a submitted collection is not public and an approved one is,
  with real signed images and nothing private; a quality matrix covers the seeded approved collection's
  detail page, its card, and the not-published state on four viewports.

## Decisions taken without the product owner (defaults, to be reviewed)

- The public identifier is the collection id; friendly slugs wait for publication.
- Approved artwork is shown through short-lived signed URLs until a public asset domain exists.
- No creator name or profile is shown; the list is capped at 60.

## Review

| Pass | Method                       | Result                                                                                                                                      |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | M7 browser and visual review | Registry order briefly changed the public navigation (every baseline moved); restored. The detail page and card were read at four viewports |
| 2    | M5 mutation proof            | 18 mutants over the list query, the allowlist, signing, and the states; all killed                                                          |
| 3    | M11 house rules (AST audit)  | Clean                                                                                                                                       |
| 4-6  | M1 re-read, M6 coverage, M7  | Zero findings and zero code edits on the final tree: **Converged**                                                                          |

## Gates (final tree)

`env:check`, `format:check`, `typecheck`, `lint` (including the repository policy), `test:unit`,
`test:integration`, `test:coverage`, `db:check`, and the full `test:e2e` exit 0.

## Findings and limits

See `docs/session-findings.md` (W4-05 section, L1 to L8). L1 needs your confirmation.
