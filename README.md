# frostbite

The frostbite is a modular Bitcoin Alkanes launchpad and game arcade. This repository is the shared
Turborepo foundation for the web application, feature plugins, reusable UI, runtime-neutral
contracts, configuration, and provider-neutral PostgreSQL infrastructure.

The product is intentionally at foundation stage. Transactional launchpad and wallet controls stay
gated until their product decisions and end-to-end verification are complete.

## Workspace

- `apps/web` — Next.js application and public arcade shell.
- `features/*` — self-describing feature registrations and lazy entrypoints.
- `packages/plugin-kit` — feature/provider registries, boot validation, dependency graph, and loading boundaries.
- `packages/shared` — runtime-neutral contracts grouped by domain.
- `packages/config` — environment catalog, validation, and mirror checks.
- `packages/database` — PostgreSQL/Drizzle connections and explicit migrations.
- `packages/ui` — reusable arcade components and design tokens.
- `tests/e2e` — Playwright browser coverage.
- `tooling/repository-policy` — executable workspace, boundary, file-size, and coverage gates.
- `packages/jobs` — provider-neutral outbox relay policy and workflow publication port.
- `apps/worker` — standalone service: signed workflow endpoint and outbox relay.

The signed Inngest adapter is registered under the exception in ADR-014 (see
[`references/workflow-adapter-gate.md`](references/workflow-adapter-gate.md) and
[`references/workflow-adapter-task-record.md`](references/workflow-adapter-task-record.md)). It runs in
`apps/worker`, which hosts the signed workflow endpoint and the outbox relay; nothing is deployed.

## Requirements

- Node.js 24 or newer
- pnpm 10.22.0
- Docker for PostgreSQL integration and coverage tests
- Playwright Chromium for browser tests

Install dependencies with `pnpm install`. Copy the appropriate checked-in environment example to
an ignored runtime environment file and replace every placeholder needed by that environment.

## Commands

```bash
pnpm dev
pnpm env:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:coverage
pnpm migration:check
pnpm build
pnpm test:e2e
pnpm stack
pnpm format:check
pnpm repository:check
```

The web container applies pending database migrations when it starts, before it serves (the image's default command), under a database
lock so containers starting together migrate once. The worker never migrates. Locally, run `pnpm --filter @ador/database migration:apply`.

`pnpm stack` starts the whole product locally (database, storage, worker, web) with seeded users, keeping its data between runs, for
manual testing in a browser; see [`tests/e2e/README.md`](tests/e2e/README.md).

Setting up preview or production (Postgres, R2, Inngest, worker, web): see
[`docs/operations/preview-environment-checklist.md`](docs/operations/preview-environment-checklist.md).

## Architecture rules

Features and providers are registered explicitly in `configs/features.ts` and
`configs/providers.ts`; the application does not discover modules through filesystem scanning or
import side effects. `configs/platform.ts` validates provider requirements, API route ownership,
and operation-ID uniqueness before an adapter serves the platform. Shared contracts remain
independent of Next.js and provider SDKs. PostgreSQL access uses standard connection URLs so
Railway, Supabase, or another compatible provider can be selected without changing application
code.

Every workspace package exposes a typecheck and meaningful test boundary. Coverage thresholds are
strictly above 90%, environment examples are pinned to one canonical key order, and handwritten
source and test files must remain at or below 300 physical lines.

GitHub Actions runs the complete environment, formatting, repository-policy, type, migration,
unit, integration, merged-coverage, build, and Playwright matrix on pull requests and `main`.
