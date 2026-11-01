# Deployment

How the Launchpad Beta is built, released and checked (ADR-009). Provider-neutral first, Railway second. What is verified
and what is not is stated in "Status" at the end; read that before relying on any step.

## What is deployed

One container image, built once (`deploy/Dockerfile`), run three ways. What a container does is chosen by its start command:

| Role    | Start command                                                               | Health check     | Notes                                                                                                   |
| ------- | --------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| web     | the image's default: `migration:apply`, then `node ...standalone/server.js` | `GET /api/ready` | Public UI, studio, `/api/v1`. Applies pending migrations before it serves. One replica until qualified. |
| worker  | `pnpm --filter worker start`                                                | `GET /ready`     | Outbox relay, cleanup, the signed Inngest endpoint. Never migrates.                                     |
| release | `pnpm --filter @ador/database migration:apply`                              | exits 0 or fails | Optional: the same migration by hand or as a platform's own step.                                       |

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
2. **Migrate.** The web container applies the pending migrations when it starts, before it serves (the image's command), with
   `DATABASE_MIGRATION_URL` when set, else `DATABASE_URL`. A failed migration stops the container, so the platform does not move
   traffic and the old version keeps serving. Every run first takes a PostgreSQL advisory lock (`packages/database/src/migrations/lock.ts`),
   so containers starting together take turns and the later ones find nothing left; one that waits longer than ten minutes fails.
   Only the web service migrates; the worker never does. The migration role needs the right to change the schema.
3. Start the new web and worker. Traffic moves only when `/api/ready` answers 200. Start the worker after the web is healthy on a
   release that changes the schema.
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
config files set the Dockerfile, the health check paths and restart policy. The web service needs no pre-deploy command: the image migrates.

Open item: Railway documents config-as-code as deprecated in favour of Infrastructure as Code (legacy files work until
2026-12-01, per the Railway docs read on 2026-10-29). The IaC reference does not describe a Dockerfile or pre-deploy setting, so
these files should be moved once it does; until then they, and the dashboard settings they stand for, are the record.

## Coolify

Written from the Coolify docs; not run on Coolify yet.

- **Web and worker:** one Docker Compose application from `deploy/docker-compose.yml` (see "Prebuilt image" below). Web: port 3000, health
  check `/api/ready`, one replica. Leave Coolify's pre-deployment command empty: it runs in the old container and is skipped on the first
  deploy, which is why the image migrates itself.
- **Database:** Coolify's PostgreSQL, or any other. `DATABASE_SSL_MODE` must match what the server offers (`verify-full` needs TLS with a
  certificate the container trusts).
- **Worker:** the second service of the same compose file, with the start command `pnpm --filter worker start` and health check `/ready`.
  With Inngest Cloud it needs a public https domain, because Inngest calls `https://<worker domain>/api/inngest` (register that URL as the
  app in the Inngest dashboard; requests are verified with `INNGEST_SIGNING_KEY`). One replica.
- **Environment:** the keys in `.env.production.example` (web) and `apps/worker/.env.example` (worker), as Coolify environment variables
  at run time. `PUBLIC_BASE_URL` is the exact https origin; `TRUSTED_PROXY_HOPS` counts Coolify's proxy (probably 1).
- **Things that stopped the first Coolify deploy** (all met on a real deployment): the compose application needs _Connect to Predefined
  Network_ on, or the web container cannot resolve Coolify's Postgres by name (`EAI_AGAIN`, the migration fails, the container restarts);
  `INNGEST_DEV` must be set to `false`; the R2 API token must be _Object Read & Write_ on both buckets (a token scoped to other buckets
  gives `403` on the readiness probe, shown only as "the object-storage provider request failed"); comments inside the compose YAML blocks
  can be rejected by Coolify's parser; a 4 GB server needs swap to survive a build, which the prebuilt image avoids.
- The first administrator's setup link is made by an operator command that must reach the database (task DOC-2).

### Prebuilt image

Building the image needs several GB of memory, which a 4 GB server does not have (a build on one froze it). `.github/workflows/publish-image.yml`
builds `deploy/Dockerfile` once on GitHub and pushes `ghcr.io/<owner>/<repo>` (lower case) tagged with the branch (`dev`, `main`) and
`sha-<short commit>`, for `linux/amd64`. Then in Coolify:

1. If the package is private, add a registry login for `ghcr.io` on the Coolify server, with a token that can read packages.
2. Create one Docker Compose application from `deploy/docker-compose.yml` (a Git source on this repository, or the file pasted in). It
   runs `web` (the image's default command) and `worker` (`pnpm --filter worker start`) from the one image, `IMAGE` in the environment
   (default `ghcr.io/adororg/frostbite:dev`; set a `sha-` tag to pin a version). The worker starts only once web is healthy, that is after
   the migrations.
3. A Docker Compose application has no Domains field of its own: the `SERVICE_URL_WEB_3000` and `SERVICE_URL_WORKER_3000` variables in the file
   give each service one (port 3000). Set each service's real host there, and for the worker use the host you register with Inngest.
4. Paste the environment once in the Developer view, from `.env.production.example`. A key the config requires blocks the deploy while it
   is empty. The values stay in Coolify at run time; the image holds no secrets. Do not set `REWARDS_TEMPLATES_DIR`: the image sets it.
5. Deploy. A new version is the same single redeploy, with a new `IMAGE` tag if you pin one.

### Deploy on every push

After the image is pushed, `publish-image.yml` calls Coolify's deploy API for the application of the pushed branch, so a push to `dev` or
`main` redeploys that branch's application. The compose file sets `pull_policy: always`, because the `dev` tag keeps its name while its content
changes. In the repository settings (Settings, Secrets and variables, Actions):

- Secret `COOLIFY_URL`: the **https** address of Coolify (the step refuses anything else, so the token is never sent in the clear).
- Secret `COOLIFY_TOKEN`: a Coolify API token (Keys & Tokens, API tokens) allowed to deploy; the API must be enabled in Coolify's settings.
  One Coolify server, so both are shared by every branch.
- Variable `COOLIFY_APP_UUID_DEV`: the UUID of the compose application that runs the `dev` image.
- Variable `COOLIFY_APP_UUID_MAIN`: the UUID of the compose application that runs the `main` image.

The variable name is `COOLIFY_APP_UUID_` plus the branch name in capitals (any other character becomes `_`). A branch without its variable is
published and not deployed. Each branch has its own Coolify application, so its environment (database, buckets, `PUBLIC_BASE_URL`, keys) is set
in that application in Coolify; nothing environment-specific is stored in GitHub. Set the `IMAGE` variable of each application to its own branch
tag (`ghcr.io/adororg/frostbite:dev` or `:main`). Coolify's own GitHub webhook is not used: it fires on the push, before the image exists.

**Deploys wait for Verify.** On a push to `dev` or `main`, `ci.yml` runs all the Verify checks, and only when they pass does it call
`publish-image.yml` (build and publish the image once, then deploy). A pull request also builds the image, as a check. A failing commit is neither published nor deployed, and the previous version keeps
running. Starting "Publish image" by hand skips that check. Deploy a `sha-` tag, not `dev`, when you want a version you can roll back to.

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

Added after: the migration moved to the start of the web container, under a lock. Verified against throwaway Postgres: four migrations
started at once finish with each recorded once, and the same test fails without the lock. Not run: the image itself with the new command.

Not verified: a real Railway or Coolify deployment (the Railway config files and CI image job were written from the platform docs and
have never run), `APP_ENV=preview` or `production` (these need https and real services), the Inngest endpoint, running more than one web
replica, base-image digest pinning, and backups, restore drill, uptime monitoring and alerts.
