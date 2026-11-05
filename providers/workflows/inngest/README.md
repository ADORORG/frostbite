# `@frostbite/provider-workflows-inngest`

Inngest adapter for the platform's workflow ports (ADR-003, ADR-014).

## Public API and registration

`inngestWorkflowProvider` is the explicit one-line registration used by `configs/providers.ts`. It
provides two typed capabilities:

- `workflow-orchestration:event-publisher` — a `WorkflowEventPublisher` for the outbox relay. The domain
  event id is sent as the Inngest event id, so re-publishing after a lost acknowledgement starts no
  second run. Events Inngest can never accept (HTTP 400, 413, 422) fail terminally; credentials, rate
  limits, outages, and network errors are retried by the relay with bounded backoff.
- `workflow-orchestration:signed-endpoint` — a factory that turns provider-neutral activities and a
  workflow policy into a fetch-style endpoint. The SDK verifies Inngest's request signature before any
  function runs, so unsigned or wrongly signed calls get 401 and never reach an activity.

## Structure

The SDK is imported only here. `asset-pipeline-function.ts` is the Inngest wiring (trigger, retries,
concurrency, non-retriable mapping); the workflow itself, `runAssetPipeline`, lives in `@frostbite/jobs` and is
parameterized over a durable step, so it is tested without the SDK. The function id and step ids are
stable compatibility surfaces. Concurrency is bounded globally and serial per asset.

## Configuration

Owns `INNGEST_APP_ID`, `INNGEST_DEV`, `INNGEST_BASE_URL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
(server-only, validated when a service is first used). A blank base URL means Inngest Cloud; outside
development, plain `http` is accepted only for loopback hosts. `INNGEST_DEV=true` is refused when `APP_ENV`
is `preview` or `production`: development mode skips request-signature verification, which would leave
the public endpoint unauthenticated.

## Dependency exception

`inngest` is pinned at 4.21.1. Its graph installs two deprecated packages, `node-domexception@1.0.0` and
`glob@10.5.0`, approved by ADR-014 for this scope only and to be re-reviewed at every upgrade.

## Tests

`test:unit` covers configuration, the publisher against real SDK error shapes, the function definition,
signature rejection, and registration. `test:integration` runs the real self-hosted Inngest server with
signing enforced (through `@frostbite/test-kit`): a signed sync, a completed run, duplicate event ids producing
one run, retries and exhaustion, permanent failure without retry, the concurrency bound, a wrong event
key, and unsigned and forged requests. Platform engineering owns this provider.

## Ownership

Platform engineering.
