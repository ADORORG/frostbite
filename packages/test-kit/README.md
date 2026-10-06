# `@ador/test-kit`

Shared, test-only helpers. Production code never imports this package.

- `@ador/test-kit/inngest-runtime` — `startInngestRuntime` starts the real self-hosted Inngest server in
  a disposable container with event and signing keys enforced and syncs an app endpoint at startup.
  Containers are removed on stop, on failure, and on SIGINT/SIGTERM. Also `freePort` and `waitFor`.
- `@ador/test-kit/inngest-runtime-api` — reads events and runs through the server's REST API. Inngest
  keeps every concurrent duplicate event record but starts one run per event id, and a run reads
  `Failed` from its first failed attempt while retries are pending, so statuses are read with care.
- `@ador/test-kit/serve-fetch-handler` — serves a fetch-style handler over HTTP and records each exchange.

Docker is required for the integration tests. Run `typecheck`, `test:unit`, `test:integration`, or
`test:coverage`. Platform engineering owns this package.
