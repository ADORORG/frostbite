# `@ador/shared`

Runtime-neutral contracts and pure domain behavior shared by browser and server runtimes.

## Public API

- `@ador/shared/allowlists` — strict Leaf V1 bytes, decoder, and SHA-256 Merkle primitives used by
  browser, server, and contract fixture tooling.
- `@ador/shared/chain` — the chain-neutral model of ADR-017: CAIP-2 `ChainRef` and `ChainFamilyId`,
  `ChainConfig` (role, per-operation finality, release gate), addresses, assets, amounts, contract
  references, transaction intents and summaries, opaque unsigned and signed payloads, broadcast
  outcomes, observations, and the neutral transaction state machine. No family concept appears here.
- `@ador/shared/chain-step-words` — the words for what can go wrong around a transaction a person signs, said once for a player's claim and a
  staff step alike: the reasons a signed transaction is turned down (`submitRefusalReasons`, which the claim and admin schemas use), the
  sentences for them (`submitRefusalWords("claim" | "step")`), and the two that do not depend on the name (`chainUnreachableWords`,
  `signatureMismatchWords`).
- `@ador/shared/collections` — collection draft and item schemas, the engineering limits, the asset
  purposes a draft may reference, and the HTTP contract (inputs, responses, routes) of the collection
  studio API, the studio page paths and the wizard link helper, and the submission and review
  contracts: the review state machine, the frozen snapshot schema, submission readiness rules, the
  review capability name, and the HTTP contracts for creators and staff.
- `@ador/shared/features` — versioned feature identifiers, capabilities, pages, navigation, and
  manifest schema.
- `@ador/shared/decisions` — accepted-decision records and fail-closed gate evaluation.
- `@ador/shared/http` — HTTP headers, methods, idempotency policy, the versioned error envelope, and
  `requestFingerprint`, a key-order-independent digest used to detect an idempotency key reused with
  different content.
  `defineOutcomes` (`@ador/shared/http` internals, used by every area's catalogue of what can go wrong: the reason a server sent is one
  of the area's own, and the words for it) backs `@ador/shared/account-outcomes` and the uploads catalogue.
- `@ador/shared/uploads` — the upload contracts and policies, the catalogue of what can go wrong when an image is sent (`uploadOutcomes`, in
  the shape of the accounts one), and `describeUploadFormats`, which says the accepted formats from the one list of accepted types.
- `@ador/shared/platform` — public platform-status input and output contracts.
- `@ador/shared/providers` — provider identities and capability-bearing manifests.

## Boundaries

This package may use runtime schemas and pure TypeScript. It must not import React, Next.js,
database clients, provider SDKs, Node-only APIs, browser globals, secrets, or feature internals.
New exports belong to a named domain subpath; there is no catch-all utilities module.

The allowlist hash implementation pins `@noble/hashes` 2.4.0: it is MIT-licensed, maintained,
runtime-neutral, and avoids separate browser/server cryptographic implementations. SHA-256 and its
sorted-pair convention are protocol behavior and are locked by Rust/TypeScript fixtures.

## Invariants

- Feature IDs are lowercase kebab-case.
- Feature versions use an explicit three-part semantic version.
- Every feature declares at least one supported capability.
- Manifests reject undeclared fields.
- Feature routes and provider requirements are runtime-validated boot contracts.
- Navigation destinations and labels are strict, unique per feature, and require the declared
  navigation capability. Each link names its `area` (`main`, `studio`, `admin`, `account`, `footer`)
  and may give an `order` (0-99, default 50) within the shown list.
- Accepted decisions require an owner, date, selected outcome, ADR, and evidence records.
- Correlation IDs are UUIDs and idempotency keys are bounded opaque values.
- HTTP errors use one strict, versioned public envelope.
- Allowlist leaves use deterministic little-endian bytes, reject trailing data and unsupported
  tags, and bind network, launch, phase, snapshot, script, allocation, asset, price, and validity.

## Verification

Run `pnpm --filter @ador/shared typecheck`, `test:unit`, `test:integration`, or `test:coverage`.
The platform engineering owner maintains this package.

## Ownership

Platform engineering.
