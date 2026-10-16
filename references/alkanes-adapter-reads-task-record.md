# The bitcoin-alkanes adapter reads (G7e-2)

Branch `feat/g7e-2-alkanes-reads`, stacked on `feat/g7e-game-rewards-contract` (baseline `601c081`). Task #75, part of #73.
Contracts and ABI: `contracts/templates/README.md`.

## What it is

The `bitcoin-alkanes` adapter can now read the game-rewards contracts through the neutral `rewards` port: `claimed(contract, holder,
milestone)` and the new `preview(item)` (picture, content type, issuer, edition). A helper (`inspectContract`) reports whether code is
deployed and its SHA-256, the figure `contracts/templates/release.json` publishes, ready for the `contracts` port in #76.

## Decisions taken on the documented defaults (review at merge)

- **Reads do not use `@alkanes/ts-sdk`.** Its read methods return `any`, give a raw hex string for simulations, log every call and need
  its WASM runtime. The adapter owns a small node boundary (`node/`): JSON-RPC over an injected `fetch`, a minimal protobuf codec for
  `MessageContextParcel` and `SimulateResponse`, and validation of every answer. The SDK remains for wallet and signing paths.
- **`preview` joins `RewardsReader`** (not a new port): a collectible is the reward. The simulated family answers `null` (it mints no items).
  The conformance suite now also requires `null` for a collectible that does not exist.
- **The code hash is the SHA-256 of the stored wasm**, checked live against contract 2:0 (not the figure `alkanes-cli --codehash` prints,
  which is a different digest).
- **Milestone key and holder rules are shared by vector files** (`abi/milestone-key-vectors.json`, `abi/holder-vectors.json`) that the Rust
  tests and these tests both read; the opcodes are checked against `abi/*.json`.
- **A picture over the configured limit is an error**, never truncated; the limit is a required argument.

## What the checks found

- Verified against the public mainnet node on 2026-10-16: a call's calldata starts with the target (`block`, `tx`), then the opcode, as
  varints; a revert or a missing contract answers with the error field, not an RPC error; a missing contract's bytecode is `0x`. The
  recorded answers are in `test/support/recorded.ts`.
- 36 mutants over the codec, transport, node, reader, holder, key, inspect and adapter wiring: 34 killed at once; two survivors (the edge
  of a safe count, and attributes failing after the picture answered) got tests and are killed.

## Not done

- The `contracts`, `reader`, `builder`, `broadcaster` and `observer` ports (#76); the SVG sanitiser (#77); wiring a real node URL into the
  application configuration.

## Found on the way (fixed in its own commit)

`apps/web/test/game-claims-flow.integration.test.ts` drove a simulated chain on a fixed clock (2026-10-16T12:00) while the claims service
read the real clock, so it passed only until a claim's expiry had passed on the wall clock (it began failing in the afternoon). The
claims config now takes an optional `clock` (production leaves it out) and the test passes its own.

## Gates (run 2026-10-16)

- `pnpm format:check`, `pnpm lint` (48 workspaces), `pnpm typecheck` (48/48), `pnpm repository:check` (48 workspaces, 1648 files): pass.
- `pnpm test:coverage`: 47 of 48 workspaces passed on the first run; the 48th, `web`, failed on the clock fault above and passes after the
  fix (32 files, 174 tests). `@ador/chain` 85 unit tests plus the live test (4, run with `ALKANES_LIVE_NODE_URL` against the public
  Subfrost mainnet node, all pass; skipped otherwise), `@ador/test-kit` conformance now also runs the real adapter's rewards reader.
  `pnpm contracts:coverage` and `pnpm repository:coverage` (merged, above 90% lines and branches): pass.
- `pnpm --filter web build`: exit 0. The full e2e run was not repeated: no page, route or browser code changed (the only app change is a
  test).
- Mutation proof: 36 mutants, all killed after two tests were added (see above).
