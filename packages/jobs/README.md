# `@ador/jobs`

Provider-neutral asynchronous job contracts and relay policies.

## Public API and invariants

`relayOutboxBatch` claims a bounded PostgreSQL-backed lease through an injected store, publishes
identifier-only domain events through an injected provider, and persists delivery, retry, or
terminal failure. Provider errors are reduced to non-sensitive operational reasons. Exponential
backoff is bounded and jitter is injected for deterministic testing. An acknowledgement records
transport delivery only; it never represents business completion.

## Verification

Run `typecheck`, `test:unit`, `test:integration`, and `test:coverage` in this workspace. Integration
tests exercise the relay contract with an in-memory conformance store; the database package owns
real-PostgreSQL adapter tests.

## Workflow ports and policy

`@ador/jobs/activities` is the provider-neutral activity contract (small statuses only).
`@ador/jobs/asset-pipeline` is the workflow itself, `runAssetPipeline`, parameterized over a durable
`step` so any provider can run it: permanent file outcomes end the run, and only faults throw and are
retried. `@ador/jobs/provider-service` defines the typed workflow capabilities a provider supplies, and
`@ador/jobs/relay-loop` runs the relay until stopped. `@ador/jobs/policy` holds the typed, overridable
defaults for retries, media concurrency, relay batching, and polling.
