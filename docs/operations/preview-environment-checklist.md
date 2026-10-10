# Preview and production environment checklist

Purpose: everything that must exist outside this repository before a preview or production
deployment of the Launchpad Beta can work. Local development needs none of this: `pnpm stack`
starts the local stack (see `tests/e2e/README.md`).

Status: **no deployment pipeline or platform configuration exists yet (task W8).** This list is
the manual procedure until it does. Nothing below has been exercised against real services.

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
- [ ] Do not rely on someone remembering to run migrations. Configure the platform's **pre-deploy
      (release) command** on the web service to run
      `pnpm --filter @ador/database migration:apply`. A failed migration then blocks the deploy and the
      old version keeps serving. Migrations never run on application startup (ADR-009), so only one
      step applies them. Configure it on one service only (web), not the worker.
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
- [ ] Run `pnpm --filter @ador/provider-object-storage-r2 smoke` (needs `PUBLIC_BASE_URL`).
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
