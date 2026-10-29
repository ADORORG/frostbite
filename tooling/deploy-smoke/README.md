# `@repo/deploy-smoke`

The check made against a deployed address before a release is accepted. Developer tooling: not shipped, and nothing in the platform
imports it.

## Public API

`pnpm --filter @repo/deploy-smoke smoke <origin> [--timeout-ms <n>]` makes seven requests as one visitor and prints PASS or FAIL for
each: ready (database and object storage), the landing page, security headers, the platform contract, a private page that redirects
to sign-in, the rendered scene files, and the games page. Exit code 0 means all passed, 1 that a check failed, 2 that the arguments
were wrong.

## Invariants

- The address must be an https origin (no path, query, or credentials); only `localhost`, `127.0.0.1` and `[::1]` may use http.
- Read-only: it only issues GET requests and sends nothing from the machine it runs on.
- Redirects are not followed, so a check that wants to see one sees it. A request that does not answer within the timeout is a failed
  check, not a hung command. Every check runs, so one failure does not hide another.
- The list of checks is data (`src/checks.ts`); adding one is one entry.

## Test commands

`pnpm --filter @repo/deploy-smoke test:unit`, `test:integration` (runs the checks against real local HTTP servers that act as a
healthy deployment and as deployments spoiled one way at a time), `test:coverage`.

## Operational ownership

Platform operations. See `docs/operations/deployment.md` for where it fits in a release.
