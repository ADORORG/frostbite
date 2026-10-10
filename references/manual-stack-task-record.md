# Local manual-test stack

Status: completed 2026-10-10; reviewed (mutation proofs, AST audit, gates) and checked in a real browser
Baseline: `bd23f68` (W4-06), branch `feat/manual-test-stack`

## Objective

One command that starts the whole product locally with seeded users, so a person can test the Week 4
flows by hand in a browser.

## What was built

- `pnpm stack` (root) runs `tests/e2e/scripts/manual-stack.ts`: a disposable PostgreSQL, local S3
  (MinIO), the worker, a self-hosted Inngest, and the web server, with the browser tests' seeded users
  and the seeded approved collection. It builds the web app first if there is no build, then prints the
  address, a console line per person that sets their session cookie, and the pages worth visiting, and
  runs until Ctrl+C.
- `tests/e2e/scripts/stack-setup.ts`: seeding and application environment, now shared by the browser
  test run and the stack, so the two cannot drift. `tests/e2e/src/manual-stack.ts` holds the plain data
  and text (people, cookie line, guide, default port), unit-tested.
- `tests/e2e/README.md` (new) documents the browser tests, fixtures, and the stack.

## Verification

- Unit tests for the pure parts; mutation proofs: 8 mutants over the port, the cookie name and flags, the
  people's tokens, and the guide, all killed. AST audit clean.
- Run for real: pages, the reviewer API, a creator's refusal (403) on the reviewer API, and the creator's
  draft list answered correctly; in Chromium the cookie line turned "Authentication required" into the
  reviewer queue. A stop leaves no process, port, or container.
- Gates run after the last script change: `format:check`, `typecheck`, `lint`, `repository:check`, and the
  `@repo/e2e` coverage run (the earlier full run of all nine gates was green before it).

## Findings

See `docs/session-findings.md` (manual-test stack section, N1 to N5).
