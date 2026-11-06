# The bitcoin-alkanes milestone-claim path (G7e-3)

Branch `feat/g7e-3-alkanes-build-observe`, stacked on `feat/g7e-4-svg-sanitiser` (baseline `56d43f5`). Task #76, part of #73.
Contracts and ABI: `contracts/templates/README.md`. The reads it builds on: `references/alkanes-adapter-reads-task-record.md`.

## What it is

The `bitcoin-alkanes` adapter can now take a player's milestone claim from intent to confirmation, behind the same neutral ports the
simulated chain implements: the builder makes a PSBT the player's wallet signs and a summary of what it does; the signed-transaction
check proves what came back is what was shown; the broadcaster sends it (the same signed transaction is always the same id, a repeat is
accepted, an unknown outcome is ambiguous with the id to follow up); the observer reports Bitcoin confirmation together with whether
the Alkanes call ran (a transaction in a block the indexer has not reached is still pending, and one whose call failed or left no trace
is reverted); the contract gateway inspects code and simulates a claim, so a player is told before they sign that it would be refused.

## Decisions taken on the documented defaults (review at merge)

- **Claims only.** The builder and simulator accept a milestone claim and refuse every other intent with a code. Template deploy, defining
  milestones with drawings in the witness, and pausing need the platform's own signer (commit/reveal envelopes, key custody, D19 and D22)
  and are task #78. The `reader` port (balances) is not provided: nothing needs it yet.
- **The player's wallet signs a PSBT** (`bitcoin-psbt/base64`). Inputs carry the wallet's own output as `witnessUtxo`; only confirmed outputs are
  spent; inputs opt in to replacement. The fee is the node's estimate for a configured confirmation target, times a size from the script
  types; it must not exceed the funding policy, and a remainder too small for change goes to the fee.
- **Output 0 is the claimant**, because that is what the contract reads (`contracts/templates/README.md`, known limits); output 1 is the
  call; change is last.
- **`verifySigned` checks presence, not validity, of signatures**: each input must carry one, and the transaction, its summary and its fee must
  be exactly what was built. A bad signature is Bitcoin's to refuse at broadcast, and the broadcast says so.
- **Observation reads the trace at the output after the last real one** (where the call's protostone sits) and reads the indexer's own height,
  so a lagging indexer never turns into a false "confirmed" or "reverted".
- **The protostone/runestone encoding is ported, not imported**, and checked three ways: an independent Python implementation
  (`abi/claim-script-vectors.json`), the traces and transactions of the real indexer, and an end-to-end run in which the TypeScript-built
  transaction is indexed and claims a milestone (`harness/tests/typescript_claim.rs`).
- **Configuration is passed in**: dust and claim-output amounts, confirmation target, lifetime, clock and provider name are `TransactionOptions`; only protocol
  facts (script sizes, tag numbers) are constants.

## What the checks found

- Against the public mainnet node (2026-10-16): an unknown transaction is answered with the text "Transaction not found" and not an error;
  a status for an unknown id looks like a mempool one (`confirmed: false`), so the observer uses the full transaction; a trace is keyed by the
  transaction id in Bitcoin's hash byte order, the reverse of the written form; the trace view answers the trace itself. Recorded in
  `test/support/recorded.ts`, and `live-node.integration.test.ts` re-checks them when `ALKANES_LIVE_NODE_URL` is set.
- Real indexer output for a successful and a reverted claim is recorded by the harness (`abi/trace-vectors.json`) and decoded by the platform.
- The indexer can simulate a claim (it changes nothing) when given a transaction with output 0 for the claimant, which is how a player is
  warned: checked in `harness/tests/simulate_claim.rs`.
- Faults found by tests: an indexed height of `""` read as block 0; fee arithmetic in floating point (170 vB at 1.1 sat/vB gave 188, now 187, in whole
  numbers); a transaction with no inputs cannot be told from a SegWit one when read back, so the simulation transaction carries a placeholder input.
- 81 mutants over the builder, coin selection, fees, encoders, verification, broadcast, observation, gateway and node code: 80 killed, after tests
  were added for the fee rounding, an added input, a changed sequence, and every script-push size boundary. One is equivalent: dropping the block-height half
  of the "in no block" check, which the types require. A redundant `confirmed` check and a dead guard in the signature check were removed from the code.

## Not done

- Template deploy, instance deploy, `define_milestone`, `pause` and `resume` (task #78); a real wallet signing a real transaction on a test network;
  wiring the adapter into the application's chain configuration; the `reader` port.

## Gates

Run 2026-10-16, niced, on a busy machine.

- `pnpm format:check`, `pnpm lint` (49 workspaces, repository policy included: it caught a 326-line test file, which was split), `pnpm typecheck` (49/49): pass.
- `pnpm contracts:test`: `rewards-core` 32 unit and 3 ABI tests; harness 26 tests (admin 5, claims 6, collectible 5, milestones 6, simulate_claim 1,
  trace_vectors 1, transfer 1, typescript_claim 1), code hashes unchanged. `pnpm contracts:coverage` `rewards-core` 97.9% regions, 100% functions, 99.5% lines.
- `pnpm test:coverage`: passes (49 workspaces, merged repository coverage above 90% lines and branches). `@frostbite/chain` has 159 unit tests; the live test (6, against the public
  mainnet node) passes with `ALKANES_LIVE_NODE_URL` set. `@frostbite/test-kit` now runs the full conformance suite against the real adapter's claim path.
  Two earlier full runs failed on `@frostbite/feature-uploads` DOM tests that exceed a 5 s timeout when the machine is loaded (a desktop file indexer was using a core,
  load average 12); the package passes alone and the third full run passed. Not caused by this change; recorded as task #79.
- `pnpm --filter web build`: exit 0. The full e2e run was not repeated: no page, route or browser code changed.
- Mutation proof: see above.
