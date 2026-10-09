# `@ador/test-kit`

Shared, test-only helpers. Production code never imports this package.

- `@ador/test-kit/inngest-runtime` — `startInngestRuntime` starts the real self-hosted Inngest server in
  a disposable container with event and signing keys enforced and syncs an app endpoint at startup.
  Containers are removed on stop, on failure, and on SIGINT/SIGTERM. Also `freePort` and `waitFor`.
- `@ador/test-kit/inngest-runtime-api` — reads events and runs through the server's REST API. Inngest
  keeps every concurrent duplicate event record but starts one run per event id, and a run reads
  `Failed` from its first failed attempt while retries are pending, so statuses are read with care.
- `@ador/test-kit/s3-runtime` — `startS3Runtime` starts the pinned MinIO image on a loopback port with
  per-run credentials, the named buckets, and CORS for the given browser origins. It is the local
  stand-in for R2 in tests and the browser e2e run. `@ador/test-kit/docker` holds the shared container
  helpers (`runDocker`, `guardContainer`, `freePort`, `containerLogs`).
- `@ador/test-kit/service-process` — `startServiceProcess` runs a repository Node entry point as a real
  child process and waits for a readiness log line.
- `@ador/test-kit/png` — `createDecodablePng` (a real gradient image) and `createUndecodablePng`
  (structurally valid, undecodable pixel data) for upload tests.
- `@ador/test-kit/images` — `createJpeg` and `createWebp`, tiny real 24x16 images (fixture data from the pinned
  `sharp`) for the other two committed upload formats.
- `@ador/test-kit/serve-fetch-handler` — serves a fetch-style handler over HTTP and records each exchange.

Docker is required for the integration tests. Run `typecheck`, `test:unit`, `test:integration`, or
`test:coverage`. Platform engineering owns this package.
