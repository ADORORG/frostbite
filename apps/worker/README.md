# `worker`

The standalone background service: it runs the outbox relay and the abandoned-upload cleanup, and
hosts the signed workflow endpoint.
It is a second deployable beside the web app and shares the platform's typed environment inventory
(ADR-012, ADR-015 proposed).

## What it does

- **Outbox relay.** A loop claims leased outbox rows, publishes them through the registered workflow
  provider with their stable event ids, and records delivery, retry, or terminal failure. It does not
  depend on any workflow function, so work recorded during a provider outage is delivered when the
  provider returns (ADR-003). Delivery never implies business completion.
- **Abandoned-upload cleanup.** A slow loop (five-minute idle delay, one-minute backoff after a
  failure; `defaultMaintenanceLoopPolicy`) removes the private objects of uploads that were never
  completed once their cleanup time has passed, and records it. Each pass logs what it found; failed
  removals are logged and retried on later passes. See `@ador/uploads` for the rules.
- **Signed workflow endpoint.** `GET|POST|PUT /api/inngest` is served by the workflow provider, which
  verifies the request signature before any activity runs. The activities (asset validation, then
  derivative generation) come from the uploads feature and see only provider-neutral inputs.
- **Bounded requests.** The listener refuses a body over 1 MiB (declared or streamed) with 413 before
  buffering it, because the endpoint is reachable by unauthenticated callers and a signature can only be
  checked after the body is read.
- **Liveness.** `GET /health` answers `{ "status": "ok" }` and says nothing about dependencies.

## Structure

- `src/main.ts` — the process shell: signals, an HTTP listener, the runtime. Excluded from in-process
  coverage; a smoke test starts it as a real process.
- `src/runtime.ts` — composes the worker from the provider registry and environment: the endpoint, the
  relay loop, and the cleanup loop.
- `src/routes.ts`, `src/endpoint.ts`, `src/relay.ts`, `src/cleanup.ts`, `src/config.ts` — routing, the
  memoized endpoint resolver (a failed build is not cached), one relay pass and one cleanup pass with
  injectable dependencies, and the port. A cleanup pass reports what it removed as its progress.

## Configuration

The environment inventory is the same as the web app's; `apps/worker/.env.example` mirrors it exactly.
`PORT` is a platform-injected system variable outside the inventory and defaults to 3001 locally.
Start with `pnpm --filter worker start` (reads `apps/worker/.env.local` when present).

## Operations

Tuning (batch size, lease, retry bounds, polling delays, retries, media concurrency) is typed policy in
`@ador/jobs/policy`, not environment. The signed endpoint needs the Inngest keys and base URL; the relay
needs the same provider settings plus PostgreSQL. A missing or invalid provider setting fails on first
use, is logged, and does not stop the process. Each media run buffers up to the upload size cap plus
decoded pixels, and `maxConcurrentMediaRuns` bounds how many run at once; a hard memory limit belongs to
the container.

## Tests

`test:unit` covers configuration, routing, the endpoint resolver, relay wiring, and the runtime.
`test:integration` runs against real PostgreSQL and the real Inngest server: an upload completion to a
processed asset, abandoned-upload cleanup (including a storage outage and a later run), recovery after a provider outage, a lost delivery acknowledgement, a rejected upload,
persistent storage failure, the HTTP surface, and the real process. Platform engineering owns this
service.
