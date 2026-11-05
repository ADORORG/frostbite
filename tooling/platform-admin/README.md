# `@repo/platform-admin`

Operator tooling. Not shipped, and nothing in the platform imports it.

Makes the single-use link that creates the platform's first administrator (ADR-021 decision 8). The link is printed to the terminal
of whoever runs the command; it is never emailed.

## Public API

`pnpm platform:setup-link [--env <file>]` reads the app's settings (default `apps/web/.env.local`, with the process environment over
it), connects to the database those settings name, and prints `<PUBLIC_BASE_URL>/setup#<token>` with its expiry.

Exit codes: `0` a link was made; `1` none was, because a working administrator already exists.

The person who opens the link signs in with the account that will administer the platform (it must hold a wallet, the policy's
`requiredMethods` for `admin`), and becomes administrator. The grant is recorded in `platform_role_events` with `via: "setup-link"`.

## Invariants

- The token is 256 random bits and appears only in the printed link. The database keeps its SHA-256, so a copy of the database
  cannot be turned into a working link.
- It follows `#`, so no server, access log or proxy ever receives it; the `/setup` page moves it out of the address bar on arrival.
- A link is valid for `setupLinkPolicy.lifetimeMs`, works once, and stops working when another is made.
- No link is made while a working administrator exists.
- The rules (which methods an administrator needs, the policy version, the lifetime) are the platform's own, imported from
  `@repo/config`; the sign-in method registry is the platform's (`@frostbite/feature-accounts/methods`).

## Where to run it

In a shell of the running web container (`pnpm platform:setup-link` from `/app`): it already has the deployment's settings and a route to
its database. From a checkout it needs a settings file with every key the web app requires and a database address that machine can reach.
Step by step: `docs/operations/deployment.md`, "First administrator". The script runs under Node's type stripping, not `tsx`, because the
production image carries no dev dependencies.

## Dependencies

`@frostbite/authorization` (the service and its database adapter), `@frostbite/database`, `@frostbite/feature-accounts/methods`, `@repo/config`.

## Configuration

`DATABASE_URL` and its pool settings, `PUBLIC_BASE_URL`: the same settings as the web app, from `apps/web/.env.local` or the
environment. The command runs against whichever database they name; point it at the deployment you mean.

## Tests

`pnpm --filter @repo/platform-admin test:unit`, `test:integration` (needs the database), `test:coverage`.

## Ownership

Platform engineering. The command line itself (`src/cli.ts`) only reads settings and prints; everything it decides is in `link.ts`
and `services.ts`, which are tested.
