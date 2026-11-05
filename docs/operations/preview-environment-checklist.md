# Preview and production environment checklist

Purpose: everything that must exist outside this repository before a preview or production
deployment of the Launchpad Beta can work. Local development needs none of this: `pnpm stack`
starts the local stack (see `tests/e2e/README.md`).

Status: **the container image, Railway configuration files, release step and smoke test exist (`docs/operations/deployment.md`, task D1) but have not run on a real platform.** This list
is the manual procedure for what lives outside the repository. Nothing below has been exercised against real services.

Preview and production are separate environments. Never share a database, bucket, Inngest app, or
secret between them. The two committed templates (`.env.preview.example`, `.env.production.example`)
differ only in `APP_ENV`, `PUBLIC_BASE_URL`, app name, `DATABASE_URL`, bucket names and `INNGEST_APP_ID`.

Secrets come from the platform's secret store only. Never commit them, log them, or put them in a
client bundle.

## 1. Postgres (managed)

- [ ] Create one database per environment (ADR-009: initial host is Railway Postgres).
- [ ] Create an application role (runtime) and, optionally, a separate migration role.
- [ ] Require TLS. `DATABASE_SSL_MODE` must be `verify-full`.
- [ ] Set `DATABASE_URL` (runtime role).
- [ ] Set `DATABASE_MIGRATION_URL` only if migrations use a different role; otherwise leave blank.
- [ ] Set `DATABASE_POOL_MAX`, `DATABASE_ACQUIRE_TIMEOUT_MS`, `DATABASE_IDLE_TIMEOUT_MS`,
      `DATABASE_STATEMENT_TIMEOUT_MS`. Keep pool size × service count below the database connection limit.
- [ ] Enable automated backups and confirm a restore works before real users arrive.
- [ ] Do not rely on someone remembering to run migrations. The web image applies pending migrations when
      it starts, before it serves, under a database lock (`deployment.md`). A failed migration stops the
      container, so the old version keeps serving. Do not also set a pre-deploy command, and do not
      migrate from the worker. The migration role (`DATABASE_MIGRATION_URL`, else `DATABASE_URL`) must be
      allowed to change the schema.
- [ ] Until the readiness check (task W8-06) exists, after each deploy confirm no migration is pending.
- [ ] Confirm `pnpm db:check` passes against the schema.

## 2. Cloudflare R2 (object storage)

Procedure and rationale: `providers/object-storage/r2/README.md`.

- [ ] Create two buckets per environment: a private bucket and a public bucket
      (`R2_PRIVATE_BUCKET`, `R2_PUBLIC_BUCKET`). Names must differ between preview and production.
- [ ] Set `R2_ENDPOINT` to `https://<account-id>.r2.cloudflarestorage.com`. Presigned URLs do not work
      on custom domains. Plain `http` is only allowed on loopback outside preview/production.
- [ ] Set `R2_REGION=auto`.
- [ ] Create an API token with object read and write on both buckets only; set `R2_ACCESS_KEY_ID` and
      `R2_SECRET_ACCESS_KEY`.
- [ ] Add a CORS rule on the **private** bucket:
      `AllowedOrigins: [<PUBLIC_BASE_URL origin>]`, `AllowedMethods: ["PUT"]`,
      `AllowedHeaders: ["content-type"]`, `MaxAgeSeconds: 3600`.
- [ ] Run `pnpm --filter @frostbite/provider-object-storage-r2 smoke` (needs `PUBLIC_BASE_URL`).
      A failing conditional-copy check is a **release blocker**.
- [ ] Note: the public bucket and any asset domain are not used yet. Approved artwork is served through
      short-lived signed links from the private bucket (ADR-016).

## 3. Inngest Cloud (background jobs)

- [ ] Create an Inngest app per environment; set `INNGEST_APP_ID`.
- [ ] Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from that app.
- [ ] `INNGEST_DEV` must be `false`.
- [ ] Leave `INNGEST_BASE_URL` blank to use Inngest Cloud.
- [ ] Register the worker's signed endpoint `https://<worker-host>/api/inngest` as the app URL and
      confirm Inngest can reach it and syncs the functions.
- [ ] Open item: ADR-015 (the worker hosts the signed Inngest endpoint) is **proposed, not approved**.

## 4. Worker service (separate from web)

- [ ] Deploy as its own service, start command `pnpm --filter worker start`.
- [ ] Give it the same environment inventory as web (`apps/worker/.env.example` mirrors it).
- [ ] `PORT` is platform-injected (default 3001). Health check: `GET /health`.
- [ ] Run exactly the instance count the outbox relay and cleanup loops are designed for; confirm
      before scaling beyond one.

## 5. Web app

- [ ] Deploy Next.js (`next start` or `start:standalone`) on the compute host (ADR-009: Railway).
- [ ] Set `APP_ENV` (`preview` or `production`), `PUBLIC_BASE_URL` (the exact public origin, https),
      `NEXT_PUBLIC_APP_NAME`.
- [ ] Set `AUTH_SESSION_IDLE_TIMEOUT_MS`, `AUTH_SESSION_ABSOLUTE_TIMEOUT_MS`,
      `PASSKEY_CHALLENGE_TIMEOUT_MS`, `PASSKEY_RECENT_AUTH_WINDOW_MS`.
- [ ] Cookies and passkeys are bound to the origin: `PUBLIC_BASE_URL` must match the real hostname, and
      changing the hostname invalidates registered passkeys.
- [ ] DNS (Cloudflare) points the hostname at the web service; TLS is valid.

## 6. Configuration validation

- [ ] Run `pnpm env:check` with the target environment's values before every build, migration and deploy.
      It fails on missing, invalid or contradictory configuration.
- [ ] Confirm no variable outside the committed inventory is set for application use.

## 7. Order of operations

1. Postgres → 2. R2 (and smoke) → 3. Inngest app → 4. secrets into the platform store →
2. `pnpm env:check` → 6. migrations → 7. deploy worker → 8. sync Inngest → 9. deploy web.

## 8. Verification after deploy

- [ ] `GET /health` on the worker returns healthy; the web app serves the home page.
- [ ] Sign-in and passkey registration work on the real hostname.
- [ ] Upload an image as a creator: the browser PUT to R2 succeeds (proves CORS) and the asset becomes ready.
- [ ] Inngest dashboard shows the synced functions and a successful run.
- [ ] Submit, review and approve a collection; the public page shows it with working artwork.
- [ ] A suspended creator's collection disappears from the public pages.

## Known gaps (do not claim otherwise)

- Real R2 has never been exercised (open item O6).
- ADR-015 is not approved (O1).
- No deployment configuration or pipeline exists (W8).
- SUBFROST chain access is not wired.
- Runbooks for auth and upload failures are still to be written (W8-07); they will live in this folder.

## Games

- [ ] FROST·BITE is played by the platform itself (`/games/frostbite`), so it needs no setting. `GAME_LAUNCHES` is
      optional and applies only to a game played at an address of its own (none is registered today): naming
      FROST·BITE or any game the platform plays itself stops the web service at start, so remove any old
      `frostbite` entry from the environment. See `docs/product/game-onboarding.md`.
- [ ] The games are built by the web build (`pnpm --filter web build`) into `apps/web/public/play`; check the deploy
      log line `Built games: ...` lists every game.

## Hardening: health checks, security headers, rate limits

Written from the code; none of it has been exercised against a real platform yet.

- [ ] **Health checks.** Point the platform's health check for the web service at `GET /api/ready` and for the
      worker at `GET /ready`. Each answers 200 when the database and object storage answer and 503 when one does
      not, and names each check (`database`, `object-storage`) with its outcome and nothing else. `GET /health`
      on the worker is liveness only. Use readiness to take an instance out of rotation, liveness to restart it.
- [ ] **`TRUSTED_PROXY_HOPS`** (blank = 1). Set it to how many reverse proxies stand in front of the app and
      append to `X-Forwarded-For`. Verify on the platform: send a request with a forged
      `X-Forwarded-For: 6.6.6.6` and check the platform's own address is the last entry the app sees. A wrong
      value either lets a client choose its own address (too low) or counts everyone as one address (too high).
      A direct run with no proxy sets `0`; then address limits are skipped.
- [ ] **`SECURITY_CSP_MODE`** (blank = `report-only`). Start in preview with `report-only`, open the main pages,
      and read the `csp-report` lines in the web service log: the only report expected is the wallet library's
      probe of script evaluation, now reported on every page (the wallet library is mounted once, in the layout, for the header wallet widget). Then set `enforce`. In a browser run of the end-to-end suite
      with `enforce`, the wallet, passkey, upload, collection, bulk upload, import and acceptance journeys all pass.
- [ ] `R2_ENDPOINT` also sets the one external origin the page policy allows images and uploads to; a different
      public asset domain for images needs adding to the policy.
- [ ] HSTS (`Strict-Transport-Security`) is sent only when `PUBLIC_BASE_URL` is https. Do not set a long
      `max-age` preload on a hostname that may change (ADR-009: hostnames are configuration).
- [ ] Rate limits are counted in the database (`rate_limit_windows`, subjects hashed), so every web instance
      shares one count. The policy is `configs/rate-limits.ts`; a change is a new version of that record.
