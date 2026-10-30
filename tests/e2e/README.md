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
until Ctrl+C. It builds the web app first (every start; Next reuses its cache, `--no-build` skips it), then
prints the address, the pages worth visiting, and which rewards chain it is on.

- **The data is kept.** The stack's PostgreSQL and S3 store (MinIO) are containers named `ador-stack-postgres` and
  `ador-stack-minio` with their data in Docker volumes (`ador-stack-postgres-data`, `ador-stack-minio-data`). Ctrl+C
  stops them and keeps them; the next `pnpm stack` starts them again, applies any new migrations, and seeds the people and
  sample content only if they are not there. The passwords they were made with are in `.stack-data/secrets.json` (ignored by
  git, owner-readable). `pnpm stack --fresh` deletes the containers, volumes and passwords first, after you type `delete`
  (`--yes` skips the question). Reasons to start over: switching to an older branch whose code is behind the data's migrations,
  or a new seeded person you want (a new fixture is not added to data that already has the others). If the volumes exist and
  `.stack-data` is gone, the stack stops and tells you to use `--fresh`. The browser tests (`pnpm test:e2e`) still use a
  disposable database and never touch these.

- **Rewards chain:** the stack takes `BETA_NETWORK` and the `REWARDS_*` settings from `apps/web/.env.local` (and
  nothing else from that file; a variable already in your shell wins). With them set it talks to that node, so staff
  steps sent from the stack are real transactions on that network; with none, claims and game administration say
  "not available". The line it prints names the network and the node's host, never the key.

- **Signing in, two ways.** The shortcut: open `http://localhost:4174/dev/sign-in` and click a person (creator, second creator,
  applicant, reviewer, administrator, email-only person, staff). It sets the session (as a fresh sign-in) and lands on that person's
  page; sign out from the same page. The real thing: `http://localhost:4174/sign-in` offers a wallet, a passkey and an emailed code.
  By default the stack sends no mail: ask for a code on the page, then run `pnpm mailbox` in another terminal to read it. If
  `apps/web/.env.local` sets `MAIL_TRANSPORT` (for example `smtp`), the stack uses that file's `MAIL_*` settings and really sends; its
  startup line says which, naming the host and never the password. The seeded
  administrator (`admin@example.test`, with a wallet) can give roles at `/admin/roles`; `candidate@example.test` is an email-only
  person to give one to.
- The sign-in page is served by the stack's own front door (`src/stack-proxy.ts`), which passes every
  other request to the web server. It is not part of the web app, so it cannot ship with a build. Its
  session cookie is secure, so use Chrome or Firefox on `localhost`.
- Default address `http://localhost:4174` (`STACK_BASE_URL` moves it; it needs an explicit port). It
  does not clash with the test run's port.
- To open the stack on a phone on the same network, serve it over HTTPS: a page on a plain `http://<address>` is not a secure
  context, so `crypto.subtle` is missing and the web app fails on load. Make a throwaway certificate for the machine's address
  (`hostname -I`) and start the stack with it:

  ```
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=<address>" -addext "subjectAltName=IP:<address>" \
    -keyout .stack-data/lan-key.pem -out .stack-data/lan-cert.pem
  STACK_HOST=0.0.0.0 STACK_BASE_URL=https://<address>:4174 \
    STACK_TLS_CERT=.stack-data/lan-cert.pem STACK_TLS_KEY=.stack-data/lan-key.pem pnpm stack
  ```

  The phone warns about the certificate once; accept it. HTTPS also lets the `Secure` session cookie be kept, so sign-in works.
  The sign-in picker lets anyone who reaches it become any seeded person, so use it only on a network you trust.

- Everything is disposable and local: the server binds the loopback address (unless `STACK_HOST` is set), the session tokens are fixed
  fixtures of a throwaway database and storage is MinIO (never real R2). The only real thing is the rewards
  chain above, when one is set. Never run it on a shared host.
- Docker is required (as for the integration tests).

## Verification

`typecheck`, `test:unit`, `test:integration`, `test:coverage` cover `src/`; the scripts are exercised by
running them. Platform engineering owns this workspace.

## Ownership

Platform engineering.
