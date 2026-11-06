# W2-10A — Automated wallet conformance architecture

Status: completed
Baseline: `f789a6ba759ddbf8f943b62421056dd499039c44`
Baseline worktree: clean
Started: 2026-09-12

## Objective

Implement the reusable device/browser/network/operation qualification evaluator so later physical
evidence can enable only passing wallet capabilities for the exact pinned LaserEyes pair.

## Done criteria

1. Candidate, evidence, policy, and enabled-provider contracts are explicit types, not route
   conditionals; deployment values remain gated by W2-10B.
2. Evidence identifies the provider and wallet version, package versions, browser, device/OS,
   network, address type, signing scheme, operation, fixture, outcome, and observation time.
3. Missing, stale, mismatched, incomplete, or failing evidence fails closed.
4. Connect, rejection, account/network changes, message signing, PSBT signing, and Alkanes fixtures
   are covered for every enabled capability.
5. Automated tests cover positive and negative qualification decisions and document the safe
   evidence contract; the physical execution runbook belongs to W2-10B.
6. The current product continues to advertise no individual wallet provider merely because
   LaserEyes lists it.
7. Physical provider execution remains the separate beta-release gate `W2-10B`.
8. Repository gates pass and this task's diff receives a `Converged` deep-review verdict.

## Approach

Keep qualification policy and evidence evaluation in `@frostbite/wallet`, while the selected candidates
and accepted evidence remain explicit configuration. Application code consumes only the evaluated
enabled capabilities. This preserves one-line detachment and avoids wallet-specific application
adapters.

## Risks and boundaries

- Automated mocks cannot prove an installed extension or physical device behaves correctly.
- Evidence must not contain addresses, public keys, signatures, PSBTs, balances, or other wallet
  data; deterministic fixture identifiers and pass/fail observations are sufficient.
- A provider may qualify for viewing or authentication without qualifying for transaction signing.
- Upgrades, browser changes, evidence expiry, wrong network, or incomplete operation coverage must
  disable the affected capability.
- Candidate selection and physical wallet access are deliberately excluded and tracked by W2-10B.

## Audit and landing

Verdict: **Converged**. Three consecutive independent review passes found no remaining verified
defect and changed nothing:

1. M1 line-by-line control-flow review after fixing duplicate evidence, exact environment/fixture,
   wallet-version, signing-scheme, and candidate-validation gaps.
2. M5 adversarial mutation review: thirteen mutations covering enablement, invalid and duplicate
   evidence, matrix construction, policy/candidate validation, clocks, provider isolation, wallet
   versions, signing schemes, and empty candidates all caused the intended tests to fail; every
   mutation was restored byte-for-byte.
3. M4 producer/consumer contract review against the pinned LaserEyes declarations and accepted
   ADR-005/ADR-006 boundaries.

An additional M11 repository-rule audit found no policy violation. All changed production and test
source files remain below 250 lines. `@frostbite/wallet` coverage is 100% for statements, branches,
functions, and lines (144 statements, 100 branches, 35 functions, and 138 lines).

Full verification passed: formatting, lint and repository policy, environment parity, TypeScript and
Rust checks, migration drift, unit tests, real-PostgreSQL integration tests, wallet browser-bundle
and standalone Next.js qualification, merged coverage above 90%, Rust host/WASM tests, production
build, and Playwright (66 passed, 6 intentionally skipped across mobile, tablet, desktop, and wide
projects). The first sandboxed build could not fetch Google Fonts; the authorized network rerun
passed and is the authoritative result.

The earlier physical blocker was split into `W2-10B` with user approval. That release gate requires
named beta wallet candidates and access to each installed wallet on the intended browser/device/OS
combinations. It does not block this automated architecture task or the remaining implementation
backlog, but it does block enabling wallet names and releasing the beta.
