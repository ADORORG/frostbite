# W4-00 — Chain-neutral contracts, adapter registry, conformance suite, and simulated family

Status: completed 2026-10-09; formal deep review Converged (see "Review")
Baseline: `6cee14d`
Depends on: ADR-017 (accepted 2026-10-09). Precedes `W4-01`.

## Objective and done criteria

Make the chain boundary neutral before collections, launches, and transactions store chain data
(ADR-017). Done means: a neutral model and ports exist; a boot-time registry checks configured chains
against registered adapters; the existing Bitcoin code sits behind a `bitcoin-alkanes` adapter; a
conformance suite and a deterministic second family prove nothing above the seam knows which family it
is; and a repository rule keeps family code and vendor SDKs behind the adapter.

## What was built

- `@ador/shared/chain`: CAIP-2 `ChainRef` and `ChainFamilyId`, capability names, `ChainConfig` (role,
  per-operation finality, release gate), addresses, assets, amounts, contract references, transaction
  intents (deploy, mint, transfer; cross-chain references refused), summaries, opaque unsigned and signed
  payloads, broadcast outcomes, observations, and the neutral transaction state machine. A compile-time
  check keeps the operations a chain needs a policy for equal to the operations an intent carries. JSON
  extensions are typed (`JsonValue`, no `unknown`) and depth-bounded.
- `@ador/chain`: the ports (`AddressCodec`, `ChainReader`, `ContractGateway`, `TransactionBuilder`,
  `Broadcaster`, `ChainObserver`), `ChainAdapter`, and `createChainRegistry`. `bitcoin-alkanes` provides
  the address codec and declares only `address:codec`.
- `@ador/test-kit`: `defineChainAdapterConformance` and its plain-function checks, the simulated family
  (`simulated-chain`, `simulated-chain-config`), run against both adapters.
- `tooling/repository-policy`: chain-family code and vendor SDK imports are allowed only in
  `packages/chain/`, `packages/wallet/`, `providers/chain/`, conformance tests, and the recorded
  `packages/auth/` exception.
- ADR-017 and plan section 9.1 updated to match the implementation, with a "Status of the
  implementation" section listing deliberate differences.

## Review

Method rotation and result (full detail is in the session ledger):

| Pass | Method                          | Result                                                                                                                                                                                                                 |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | M1 whole-file read              | 9 findings fixed: dead registry branch, comment claiming capability validation that did not exist, two operation lists that could drift, conformance hole (an `unavailable` broadcast skipped observation), and others |
| 2    | M4 contract diff                | Plan 9.1 and ADR-017 disagreed with the implemented signatures; both corrected                                                                                                                                         |
| 3    | M5 mutation proof               | 41 mutants, 40 killed; the survivor is equivalent (see below)                                                                                                                                                          |
| 4    | M11 house rules                 | Reuse of a chain config fixture, named constants, dead `Entry` type                                                                                                                                                    |
| 5    | M6 coverage walk                | Holes closed with tests; two unreachable defensive branches removed                                                                                                                                                    |
| 6    | M8 adversarial input            | A 20,000-deep `extension` made `safeParse` throw a stack-overflow `RangeError`; depth is now bounded                                                                                                                   |
| 7-9  | M1 final, M6 gates, M9 siblings | Zero findings and zero edits: **Converged**                                                                                                                                                                            |

Negative tests assert the specific rule they trip, not only that something throws. The one surviving
mutant (`value: text` for `value: result.value.address` in the bitcoin codec) is equivalent: validation
already requires the text to equal the canonical form.

## Gates (final tree)

`env:check`, `format:check`, `typecheck`, `lint`, `test:unit`, `test:integration`, `test:coverage` (merged
repository thresholds pass), `db:check`, `build`, and `repository:check` all exit 0. Coverage: chain 100 %
lines and branches; shared 100 % lines, 98.07 % branches; test-kit 99.71 % lines, 99.08 % branches;
repository-policy 96.36 % lines, 92.94 % branches. Every changed file is under 300 lines (largest 222).
`test:e2e` was not rerun: the diff touches no web, worker, or e2e code.

## Flake fixed along the way

`providers/workflows/inngest` > `signed-boundary` > "synced the signed endpoint at startup" asserted the
runtime's one startup sync before it had happened (the server is healthy before it syncs). It failed 3 of
3 under CPU load and failed the coverage gate once. It now waits for the sync; 3 of 3 pass under the same
load.

## Known limits and handoffs

- `bitcoin-alkanes` provides the address codec only. Reads, simulation, construction, broadcast, and
  observation arrive with W6 and W7; a feature requiring them fails at boot until then.
- No environment key carries the chain list yet. `W4-01` loads `ChainConfig[]` into the registry when it
  adds the target-chain field, and must add the key through the environment contract.
- `bigint` amounts do not serialise to JSON. The first HTTP or database consumer must define the wire
  form (decimal strings).
- `packages/auth/` still imports `@ador/chain/bitcoin` directly; the exception ends with the
  network-to-chain migration (ADR-017 section 7), which waits for the W2-10B wallet evidence.
- Cancellation and expiry states are not in the neutral state machine; W7-03 and W7-00 own them.
- `zod` in test-kit uses the same caret range as `@ador/shared` (a known repository-wide pattern).
