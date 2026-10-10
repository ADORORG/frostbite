# `@repo/e2e`

Playwright browser coverage on the real stack, plus the local manual-test stack that uses the same
services and seeded users.

## Browser tests

`pnpm test:e2e` (from the repository root) builds the app, starts a disposable PostgreSQL, local S3
(MinIO), the worker, and a self-hosted Inngest, seeds the fixture users, and runs Playwright on four
viewport projects (mobile, tablet, desktop, wide). Real-service flows (uploads, collections, review)
run on desktop only (`desktopOnlySpecs` in `playwright.config.ts`); the experience-quality matrices
(axe, keyboard, reduced motion, visual baselines) run on every viewport. Update a visual baseline only
after reading the diff: `pnpm test:e2e -- --update-snapshots changed <spec>`.

- `src/creator-fixtures.ts` is the one list of seeded users and their session tokens. A new fixture is
  seeded automatically (`scripts/stack-setup.ts`).
- `scripts/public-collection-seed.ts` seeds an approved collection with fixed content for the public
  page checks.
- Quality specs that need fixed data answer the API call that carries it (`tests/support/review-mocks.ts`),
  parsed through the shared contract, so a mock that drifts from it fails loudly.

- `screenshot.css` is applied only while a screenshot is taken: it fixes the sticky header and area
  sidebar in place, since a full-page capture would otherwise draw them away from their place in the page.
- Journey specs (`navigation.spec.ts`, `studio-home.spec.ts`) reach pages by clicking only, as a person
  would; a spec that jumps to a URL is testing a page, not a journey.

## Manual test stack

`pnpm stack` runs the whole product locally for a person to drive by hand: the same disposable
PostgreSQL, S3, worker, Inngest, and web server as the browser tests, with the same users, kept running
until Ctrl+C. It builds the web app first if there is no build, then prints the address and the pages
worth visiting.

- **Signing in:** open `http://localhost:4174/dev/sign-in` and click a person (creator, second creator,
  applicant, reviewer, staff). It sets the session and lands on that person's page. Real sign-in is by
  wallet and is not enabled yet; this page stands in for it. Sign out from the same page.
- The sign-in page is served by the stack's own front door (`src/stack-proxy.ts`), which passes every
  other request to the web server. It is not part of the web app, so it cannot ship with a build. Its
  session cookie is secure, so use Chrome or Firefox on `localhost`.
- Default address `http://localhost:4174` (`STACK_BASE_URL` moves it; it needs an explicit port). It
  does not clash with the test run's port.
- Everything is disposable and local: the server binds the loopback address, the session tokens are fixed
  fixtures of a throwaway database, storage is MinIO (never real R2), and nothing touches a chain. Never
  run it on a shared host.
- Docker is required (as for the integration tests).

## Verification

`typecheck`, `test:unit`, `test:integration`, `test:coverage` cover `src/`; the scripts are exercised by
running them. Platform engineering owns this workspace.
