# Launchpad Beta implementation task ledger

Status: active  
Milestone: Launchpad Beta  
Canonical status source: this file  
Last synchronized: 2026-10-06

This ledger tracks every implementation task in the eight-week Launchpad Beta milestone. The
milestone defines scope and acceptance criteria; this file records execution status. Task records
under `references/` retain detailed evidence, baselines, decisions, and review results.

## Status contract

- `completed`: implementation and required verification finished; a converged task record exists.
- `in_progress`: the only task currently being changed.
- `pending`: ready after its dependencies and decision gates are satisfied.
- `blocked`: cannot start because a named external dependency or decision gate is unresolved.
- `deferred`: explicitly outside this milestone; tracked in the milestone rather than here.

Only one task may be `in_progress`. A task may become `completed` only after its own diff receives a
`Converged` verdict under the repository review workflow. Whenever implementation starts, completes,
becomes blocked, or is unblocked, this ledger and the applicable task record must be updated in the
same change. Never infer completion from a commit, passing test, or partially delivered dependency.

## Current position

| Field                   | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| Active task             | `W3-06` Upload progress, retry, validation-error, and asset library |
| Next ordered task       | `W3-07` Private draft access and cleanup                            |
| Current milestone phase | Week 3 — Upload pipeline                                            |
| Parallel security gate  | `SEC-D15-04` remains blocked                                        |
| Mainnet                 | Outside this milestone and blocked by a separate readiness decision |

## Week 1 — Workspace and executable architecture

| ID    | Task                                                                                                            | Status    | Evidence or blocker                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------- |
| W1-01 | Initialize pnpm, Turborepo, Cargo, and the target workspace structure                                           | completed | Repository history and workspace manifests                                 |
| W1-02 | Enforce real per-workspace typecheck, unit, integration, and coverage scripts plus Playwright for runnable apps | completed | Repository policy tests and CI configuration                               |
| W1-03 | Implement typed environment validation, documented template parity, and `env:check` gates                       | completed | Environment package, app-local mirror, database commands, and parity tests |
| W1-04 | Enforce the 300-line handwritten source limit and record legacy exceptions                                      | completed | Repository policy package                                                  |
| W1-05 | Build provider-neutral PostgreSQL and Drizzle foundations with real-database tests                              | completed | `references/task-record.md`                                                |
| W1-06 | Implement explicit feature/provider manifests and boot validation                                               | completed | `references/plugin-boot-task-record.md`                                    |
| W1-07 | Build the portable HTTP operation boundary and thin `/api/v1` Next.js adapter                                   | completed | HTTP foundation commits                                                    |
| W1-08 | Generate the framework-neutral OpenAPI contract from executable schemas                                         | completed | `references/openapi-task-record.md`                                        |
| W1-09 | Implement the signed workflow boundary and transactional outbox foundation                                      | completed | `references/outbox-task-record.md`                                         |
| W1-10 | Add CI, dependency-boundary, coverage, build, migration, and E2E gates                                          | completed | Repository workflow and policy tests                                       |
| W1-11 | Enforce unresolved product and security decisions as fail-closed runtime gates                                  | completed | `references/decision-gate-task-record.md`                                  |
| W1-12 | Prove one-line detachable feature and provider composition                                                      | completed | `references/detachable-composition-task-record.md`                         |

## Week 2 — Authentication, authorization, and shell

These tasks retain their dependency order. `W2-01` through `W2-08` are the ordered sequence formerly
stored in `references/task-list.md`.

| ID     | Task                                                                                      | Status    | Evidence or blocker                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| W2-01  | Qualify and exact-pin the LaserEyes and Alkanes SDK wallet stack                          | completed | `references/wallet-stack-qualification-task-record.md`                                                                    |
| W2-02  | Resolve the LaserEyes advisory gate for beta                                              | completed | `references/lasereyes-advisory-resolution-task-record.md`; accepted beta exception remains constrained                    |
| W2-03  | Enforce detachable feature and wallet-provider composition                                | completed | `references/detachable-composition-task-record.md`                                                                        |
| W2-04  | Implement canonical wallet authentication and hash-only sessions                          | completed | `references/wallet-authentication-task-record.md`                                                                         |
| W2-05  | Implement UUIDv7 accounts, organizations, memberships, roles, and authorization           | completed | `references/authorization-accounts-task-record.md`                                                                        |
| W2-06  | Implement the authenticated account, studio, and admin route family                       | completed | `references/authenticated-routes-task-record.md`                                                                          |
| W2-07  | Implement curated creator admission and minimal staff approval                            | completed | `references/creator-admission-task-record.md`; deep review converged after exhaustive mutation proof                      |
| W2-08  | Implement the remaining public product route families                                     | completed | `references/public-product-routes-task-record.md`; deep review converged after mutation proof                             |
| W2-09  | Add authenticated passkey linking with conflict and final-method protections              | completed | `references/passkey-linking-task-record.md`; deep review converged after dynamic mutation proof                           |
| W2-10A | Implement automated fail-closed wallet conformance architecture                           | completed | `references/wallet-device-conformance-task-record.md`; mutation-proven, 100% branch coverage                              |
| W2-10B | Qualify and enable supported wallets on real browsers and devices                         | blocked   | Diagnostic diff converged (`b348685`); needs exact-version physical evidence: UniSat/Oyl network switching, PSBT, Alkanes |
| W2-11  | Close the Week 2 visual, accessibility, keyboard, responsive, and reduced-motion matrix   | completed | `references/week-two-experience-quality-task-record.md`; repaired and mutation-proven deep-review findings                |
| W2-12  | Integrate manifest-driven links for every testable page and truthful authentication state | completed | `references/integrated-navigation-task-record.md`; deep review converged with mutation and browser evidence               |

## Week 3 — Upload pipeline

| ID     | Task                                                                              | Status    | Evidence or blocker                                                                                                 |
| ------ | --------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| W3-01  | Implement the provider-neutral object-storage port and R2 adapter                 | completed | `references/object-storage-task-record.md`                                                                          |
| W3-01A | Expose typed provider runtime resolution without vendor imports in features       | completed | `references/provider-runtime-task-record.md`                                                                        |
| W3-02  | Persist and authorize short-lived direct-upload intents before signing            | completed | `references/upload-intents-task-record.md`                                                                          |
| W3-03  | Add asset persistence and idempotent processing jobs for completed uploads        | completed | `references/asset-processing-task-record.md`                                                                        |
| W3-04  | Validate file signatures, MIME, size, decoded dimensions, and checksums           | completed | `references/media-validation-task-record.md`; structural validation only, not yet triggered (workflow adapter gate) |
| W3-05  | Generate thumbnails and previews for PNG, JPEG, and WebP                          | completed | `references/thumbnail-derivatives-task-record.md`; provider-standard decoder, not yet triggered                     |
| W3-05A | Implement the signed Inngest adapter and trigger upload validation and processing | completed | `references/workflow-adapter-task-record.md`; completed; all root gates green; review Converged (3 clean passes)    |
| W3-06  | Build upload progress, retry, validation-error, and asset-library UI              | pending   | Depends on W3-02 through W3-05                                                                                      |
| W3-07  | Enforce private draft access and abandoned-upload cleanup                         | pending   | Depends on W3-03 and authorization                                                                                  |
| W3-08  | Close positive, negative, unauthorized, retry, and idempotency acceptance tests   | pending   | Depends on W3-01 through W3-07                                                                                      |

## Week 4 — Collection and creator workflow

| ID    | Task                                                                                | Status  | Evidence or blocker                      |
| ----- | ----------------------------------------------------------------------------------- | ------- | ---------------------------------------- |
| W4-01 | Implement collection/project records, versioned drafts, metadata, supply, and items | pending | Depends on Week 3 and creator admission  |
| W4-02 | Build the resumable creator collection wizard                                       | pending | Depends on W4-01                         |
| W4-03 | Implement immutable submission snapshots and review state transitions               | pending | Depends on W4-01 and staff authorization |
| W4-04 | Enforce no self-approval and approval/revocation concurrency invariants             | pending | Depends on W4-03                         |
| W4-05 | Build approved public collection list and detail pages                              | pending | Depends on W4-03                         |
| W4-06 | Add creator/staff audit visibility                                                  | pending | Depends on W4-03                         |
| W4-07 | Complete the internal-alpha end-to-end workflow and acceptance gate                 | pending | Depends on W4-01 through W4-06           |

## Week 5 — Launch phases and allowlists

| ID    | Task                                                                        | Status  | Evidence or blocker                                    |
| ----- | --------------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| W5-00 | Accept D13, D14, D15, D17, and D18 entry decisions                          | blocked | D13, D14, D17, D18 unresolved; D15 remains researching |
| W5-01 | Implement launch, immutable launch-version, and mint-phase models           | blocked | Depends on W5-00                                       |
| W5-02 | Build the fixed-price, contract-native block-window phase editor            | blocked | Depends on W5-00 and W5-01                             |
| W5-03 | Implement manual/CSV allocation validation, duplicate reporting, and limits | blocked | Depends on W5-00 and W5-01                             |
| W5-04 | Lock eligibility snapshots and generate reproducible proofs                 | blocked | Depends on W5-00, W5-03, and accepted D15              |
| W5-05 | Prove copied/replayed proofs cannot affect another wallet's allocation      | blocked | Depends on W5-04 and accepted D15                      |
| W5-06 | Build the collector eligibility endpoint and UI                             | blocked | Depends on W5-04                                       |
| W5-07 | Build public launch detail, progress, and system states                     | blocked | Depends on W5-01 and W5-02                             |
| W5-08 | Close locked-root, eligible/ineligible, and neutral-domain acceptance tests | blocked | Depends on W5-01 through W5-07                         |

## Week 6 — Hardened contract template

| ID    | Task                                                                       | Status  | Evidence or blocker                       |
| ----- | -------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| W6-00 | Accept D19 administration/freeze policy and retain the Week 5 gate         | blocked | D19 and W5-00 unresolved                  |
| W6-01 | Port collection/instance concepts into versioned contract templates        | blocked | Depends on W6-00                          |
| W6-02 | Replace hard-coded contract settings with validated initialization         | blocked | Depends on W6-01                          |
| W6-03 | Enforce payment, phase, supply, wallet limits, and eligibility on-chain    | blocked | Depends on W6-01, W5-00, and accepted D15 |
| W6-04 | Pin deterministic WASM/ABI builds and generate typed clients               | blocked | Depends on W6-01                          |
| W6-05 | Add runtime, negative, boundary, initialization, and duplicate-claim tests | blocked | Depends on W6-02 through W6-04            |
| W6-06 | Deploy, inspect, and bind the test contract to its reviewed code hash      | blocked | Depends on W6-05 and test-network access  |

## Week 7 — Mint transaction lifecycle

| ID    | Task                                                                       | Status  | Evidence or blocker                              |
| ----- | -------------------------------------------------------------------------- | ------- | ------------------------------------------------ |
| W7-00 | Accept D22 transaction confirmation and reconciliation policy              | blocked | D22 unresolved                                   |
| W7-01 | Implement expiring mint quotes and pre-sign simulation                     | blocked | Depends on W6-06 and W7-00                       |
| W7-02 | Build unsigned mint transactions and wallet-signing integration            | blocked | Depends on W7-01 and qualified wallet capability |
| W7-03 | Implement idempotent broadcast and the persisted transaction state machine | blocked | Depends on W7-02                                 |
| W7-04 | Implement confirmation, indexer observation, and reconciliation jobs       | blocked | Depends on W7-00 and W7-03                       |
| W7-05 | Build collector transaction history and creator mint activity              | blocked | Depends on W7-03 and W7-04                       |
| W7-06 | Close duplicate, rejection, expiry, failure, lag, and recovery E2E cases   | blocked | Depends on W7-01 through W7-05                   |

## Week 8 — Frostbite catalog, hardening, and beta release

| ID    | Task                                                                                                                  | Status  | Evidence or blocker                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| W8-01 | Implement the versioned game manifest, games catalog, and game detail feature                                         | pending | Depends on public product routes                            |
| W8-02 | Register Frostbite with configurable play URL, base path, return URL, and network                                     | pending | Depends on W8-01                                            |
| W8-03 | Verify subdomain-style and domain-path-style game hosting                                                             | pending | Depends on W8-02                                            |
| W8-04 | Complete critical collector, creator, staff, transaction, game, and degradation E2E coverage                          | blocked | Depends on Weeks 3 through 7                                |
| W8-05 | Complete all-route visual, accessibility, responsive, keyboard, and state matrices                                    | blocked | Depends on all route families                               |
| W8-06 | Add rate limits, security headers, health checks, dashboards, and alerts                                              | pending | Depends on deployment configuration                         |
| W8-07 | Verify backup/restore and write authentication, upload, provider, indexer, transaction, launch, and rollback runbooks | pending | Depends on implemented operational flows                    |
| W8-08 | Deploy the beta and seed an honestly represented demonstration launch                                                 | blocked | Depends on all milestone acceptance gates, including W2-10B |
| W8-09 | Record the smoke test, rollback exercise, release notes, and remaining limitations                                    | blocked | Depends on W8-08                                            |

## Parallel security and product-decision gates

These tasks do not authorize dependent production behavior until their final gate is accepted.

W2-10B is `blocked` on external physical evidence (see its row); collect exact-version physical approval/rejection, account/network-change,
and server-verification evidence for each candidate. The diagnostic message flow makes that part
testable without enabling sign-in. PSBT and Alkanes evidence remain outstanding. Public exposure
also remains subject to W8-06 rate limits and W8-07 diagnostic challenge-retention operations.

| ID         | Task                                                                          | Status    | Evidence or blocker                                |
| ---------- | ----------------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| SEC-D15-01 | Define deterministic Leaf V1 and cross-language Merkle fixtures               | completed | `references/allowlist-proof-spike-task-record.md`  |
| SEC-D15-02 | Prove claimant-bound P2TR/P2WPKH transaction signatures                       | completed | `references/claimant-binding-task-record.md`       |
| SEC-D15-03 | Specify an authoritative authenticated-prevout runtime capability             | completed | `references/authenticated-prevout-task-record.md`  |
| SEC-D15-04 | Implement and validate authenticated prevouts in the upstream runtime/indexer | blocked   | External upstream capability is absent             |
| SEC-D15-05 | Exercise a stateful claim contract in the canonical indexer harness           | blocked   | Depends on SEC-D15-04                              |
| SEC-D15-06 | Measure action fuel and final witness/calldata weight                         | blocked   | Depends on SEC-D15-05                              |
| SEC-D15-07 | Qualify the signed PSBT path through LaserEyes and the Alkanes SDK bridge     | blocked   | Depends on SEC-D15-05 and provider/device evidence |
| SEC-D15-08 | Accept D15 and publish the final mechanism ADR                                | blocked   | Depends on SEC-D15-04 through SEC-D15-07           |
| DEC-D13    | Decide art publication and inscription strategy                               | pending   | Required before Week 5                             |
| DEC-D14    | Decide collection content and metadata policy                                 | pending   | Required before Week 5                             |
| DEC-D17    | Decide the accepted payment asset                                             | pending   | Required before Week 5                             |
| DEC-D18    | Decide platform fees and proceeds policy                                      | pending   | Required before Week 5                             |
| DEC-D19    | Decide contract administration and freeze policy                              | pending   | Required before Week 6                             |
| DEC-D22    | Decide confirmation, lag, replacement, and completion policy                  | pending   | Required before Week 7                             |

## Synchronization checklist

For every implementation task:

1. Change its status here to `in_progress` before implementation and name its dependencies.
2. Create or update its task record under `references/` with baseline and done criteria.
3. If new work is discovered, add a stable task ID here instead of silently expanding scope.
4. Record blockers as concrete gates; do not replace them with assumptions or feature flags.
5. After all gates and the required deep review converge, change the status to `completed` in the
   same commit as the final task record.
6. Set the next eligible task to `in_progress` only after the prior task is completed.
