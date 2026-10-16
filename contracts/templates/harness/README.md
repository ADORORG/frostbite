# harness

Runs the contracts through the real Alkanes indexer (`index_block`, the mainnet code path) under
`wasm-bindgen-test-runner`. Test-only crate.

- **Run:** `../ci.sh test` (builds both contracts first; the tests embed the wasm in `../target`).
- **Layout:** `tests/support/chain.rs` builds a block (deploy, then administration and claim
  transactions; every transaction spends its own made-up output so no two share an id, which is how
  traces are keyed); `tests/support/read.rs` reads views; the test files are `admin`, `milestones`,
  `claims`, `collectible` and `transfer` (records the no-transfer-lock limit).
- **Opcodes** come from `rewards_core::opcode`, so a literal in a contract that drifts from its
  constant fails a test here.
- **Owner:** contract engineering.
