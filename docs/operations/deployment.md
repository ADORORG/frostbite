# Deployment

How the Launchpad Beta is built, released and checked (ADR-009). Provider-neutral first, Railway second. What is verified
and what is not is stated in "Status" at the end; read that before relying on any step.

## What is deployed

One container image, built once (`deploy/Dockerfile`), run three ways. What a container does is chosen by its start command:

| Role    | Start command                                        | Health check     | Notes                                                      |
| ------- | ---------------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| web     | the image's default (`node ...standalone/server.js`) | `GET /api/ready` | Public UI, studio, `/api/v1`. One replica until qualified. |
| worker  | `pnpm --filter worker start`                         | `GET /ready`     | Outbox relay, cleanup, the signed Inngest endpoint.        |
| release | `pnpm --filter @ador/database migration:apply`       | exits 0 or fails | Runs once per release, before the new web starts.          |

Secrets and settings are never in the image. They come from the platform's environment at run time; the keys are the ones in
`.env.production.example` (web) and `apps/worker/.env.example` (worker), which mirror the typed environment definition. The build
reads no secrets. `pnpm env:check` runs before any build or release.

The image also holds the scene videos (`pnpm scenes:render` runs in the build), the built games, and the two released contract templates
(`/opt/templates`, which `REWARDS_TEMPLATES_DIR` points at by default; set it to something else to use other files, or to nothing to
turn template publishing off).

The templates are not compiled in the image. The same source builds to different bytes in a different environment (checked: Debian 12
with clang 14 and Ubuntu 24.04 with clang 18 both differ from the released build), and a template's code hash must not change without a
new template version. So the released `.wasm` files are kept in `contracts/templates/released/`, `repository:check` and the image build
fail unless they equal `contracts/templates/release.json`, and the image copies them. To release a new template version, run
`contracts/templates/build.sh --write` (it rewrites `release.json` and `released/` together) and commit both.

## Build

```
docker build -f deploy/Dockerfile -t the-well:<git-sha> .
```

The build installs from the lockfile (`--frozen-lockfile`), renders the scene videos, builds the games and the Next.js standalone
server, then drops dev dependencies. Build once and promote the same image through preview and beta; do not rebuild per environment.

## Release order

1. Build the image from the commit that passed CI.
2. **Migrate** (release step). On Railway this is the web service's pre-deploy command (`deploy/railway/web.json`); elsewhere
   run the `release` command against the new image with the migration database URL. A failed migration stops the release and the old
   version keeps serving. Migrations never run when the application starts (ADR-009), and only the web service runs them.
3. Start the new web and worker. Traffic moves only when `/api/ready` answers 200.
4. **Smoke test** the deployed address: `pnpm --filter @repo/deploy-smoke smoke https://<host>`. Any failed check means the
   release is not accepted: roll back.
5. Watch `/api/ready` and the logs.

## Rollback

Redeploy the previous image. Schema changes must be expand/migrate/contract so the previous version still runs against the
new schema (ADR-009); a migration that is not backward compatible needs its own plan before release.

## The smoke test

`tooling/deploy-smoke` makes seven requests as one visitor and prints PASS or FAIL for each: ready (database and object storage),
landing page, security headers, the platform contract, a private page that redirects to sign-in, the rendered scene files, and the
games page. It refuses http addresses except `localhost`, and exits non-zero on any failure. It reads nothing and writes nothing.

## Railway

Two services from the same repository, each with its config file path set to `deploy/railway/web.json` and
`deploy/railway/worker.json`, plus Railway PostgreSQL. Set the variables from the environment templates on each service. The
config files set the Dockerfile, the web pre-deploy migration, the health check paths and restart policy.

Open item: Railway documents config-as-code as deprecated in favour of Infrastructure as Code (legacy files work until
2026-12-01, per the Railway docs read on 2026-10-29). The IaC reference does not describe a Dockerfile or pre-deploy setting, so
these files should be moved once it does; until then they, and the dashboard settings they stand for, are the record.

## Checklist before the first real deployment

See `preview-environment-checklist.md` for the accounts and settings outside this repository (Postgres, R2, Inngest, domain,
passkeys). Not yet done there: backups and a restore drill, uptime monitoring and alerts, the canonical hostname.

## Status (what was and was not verified)

Checked on 2026-10-29, on one machine, against throwaway Postgres 18 and MinIO containers (placeholder credentials, `APP_ENV=local`):

- The image builds (`docker build -f deploy/Dockerfile .`, about 5 minutes cold) and is 2.8 GB. It holds the full production `node_modules`
  and the worker's sources, because the worker and the migration run TypeScript from the workspace packages.
- Release: `pnpm --filter @ador/database migration:apply` ran in the image and created the `ador` schema.
- Web: started from the image, `/api/ready` answered 200 with database and object storage `ok`; the smoke test passed all 7 checks. With
  object storage stopped, `/api/ready` answered 503 and the smoke test failed and exited 1.
- Worker: `pnpm --filter worker start` from the same image answered `/health` and `/ready` with 200.
- A container needs no network access to start: the package manager is in the image, nothing is downloaded at run time.

Not verified: a real Railway or Coolify deployment (the Railway config files and CI image job were written from the platform docs and
have never run), `APP_ENV=preview` or `production` (these need https and real services), the Inngest endpoint, running more than one web
replica, base-image digest pinning, and backups, restore drill, uptime monitoring and alerts.
