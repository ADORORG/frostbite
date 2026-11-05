# `@ador/test-kit`

Shared, test-only helpers. Production code never imports this package.

- `@ador/test-kit/inngest-runtime` — `startInngestRuntime` starts the real self-hosted Inngest server in
  a disposable container with event and signing keys enforced and syncs an app endpoint at startup.
  Containers are removed on stop, on failure, and on SIGINT/SIGTERM. Also `freePort` and `waitFor`.
- `@ador/test-kit/inngest-runtime-api` — reads events and runs through the server's REST API. Inngest
  keeps every concurrent duplicate event record but starts one run per event id, and a run reads
  `Failed` from its first failed attempt while retries are pending, so statuses are read with care.
- `@ador/test-kit/s3-runtime` — `startS3Runtime` starts the pinned SeaweedFS image on a loopback port with
  per-run credentials, the named buckets, and CORS for the given browser origins. It is the local
  stand-in for R2 in tests and the browser e2e run. `@ador/test-kit/docker` holds the shared container
  helpers (`runDocker`, `guardContainer`, `freePort`, `containerLogs`).
- `@ador/test-kit/service-process` — `startServiceProcess` runs a repository Node entry point as a real
  child process and waits for a readiness log line.
- `@ador/test-kit/png` — `createDecodablePng` (a real gradient image) and `createUndecodablePng`
  (structurally valid, undecodable pixel data) for upload tests.
- `@ador/test-kit/images` — `createJpeg` and `createWebp`, tiny real 24x16 images (fixture data from the pinned
  `sharp`) for the other two committed upload formats.
- `@ador/test-kit/chain-conformance` — `defineChainAdapterConformance`, the suite every chain adapter must
  pass (ADR-017): canonical addresses and refusal of invalid, cross-chain, and unserved input; summary
  fidelity; verification of what was signed; idempotent broadcast; repeatable observation; chain-bound
  reads. Each group runs only for a port the adapter declares. The checks are plain functions, and tests
  prove each one fails for a deliberately broken adapter.
- `@ador/test-kit/simulated-chain` — `createSimulatedChain`, a deterministic second chain family with a
  different address format, finality model, and transaction shape, plus controls to advance blocks,
  fund an address, and force a rejected, unavailable, or ambiguous broadcast. Test-only: the registry
  refuses it for any chain whose role is not `test`. `@ador/test-kit/simulated-chain-config` gives
  `simulatedChainConfig`, a ready `ChainConfig` for it, so a feature test boots the registry in one call.
- `@ador/test-kit/storage-registry` — `storageRegistry` (a provider registry whose only provider supplies
  `object-storage:s3-compatible`) and `unusedStorage` (a storage port that fails on any call it was not
  given), for feature composition tests.
- `@ador/test-kit/collection-database` — `seedReadyCollection`, an approved creator's collection that is
  ready to submit (written directly, so a suite needs no collections package), and `seededChain`.
  `@ador/test-kit/creator-database` also has `seedPlatformUser` for a reviewer or staff member.
- `@ador/test-kit/library-asset` — `libraryAssetFixture`, a processed library asset with a thumbnail, as the
  uploads library presents it to a browser.
- `@ador/test-kit/race` — `holdTransaction` (open a transaction, take a lock or make a change, keep it open)
  and `expectToWait` (prove an operation is blocked by it, then let it commit), the shared way to test that
  a change in flight makes another operation wait and then see it.
- `@ador/test-kit/touch-screen` — `stubPointer(coarse)`: a Node page whose main pointer is a finger or a mouse, for a game's drawing tests.
- `@ador/test-kit/dom` — React Testing Library helpers for jsdom suites (render with cleanup, typed
  fetch stubs, storage reset) shared by every feature's `unit-dom` project.
- `@ador/test-kit/serve-fetch-handler` — serves a fetch-style handler over HTTP and records each exchange.

Docker is required for the integration tests. Run `typecheck`, `test:unit`, `test:integration`, or
`test:coverage`. Platform engineering owns this package.

## Ownership

Platform engineering.
