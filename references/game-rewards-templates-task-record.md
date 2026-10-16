# The game-rewards contract templates (G7e-1)

Branch `feat/g7e-game-rewards-contract`, stacked on `spike/g7e-game-rewards-alkanes` (baseline `c71cf51`). Task #74, part of #73.
Decisions: ADR-018 Amendment 3 (outside the repository tree). Layout, ABI, limits and the chain-neutral mapping:
`contracts/templates/README.md`.

## What it is

Two Alkanes contracts and the code they share. One `game-rewards` instance per game (created from the one audited template) lets a
wallet claim a milestone up to a per-milestone limit and returns a `milestone-collectible` of its own, numbered within the
milestone. The platform holds the auth token that defines milestones and pauses claims. A collectible's picture is the builder's
drawing in a generated frame, or a generated 16 by 16 sprite when the milestone has none.

## Decisions taken (owner, 2026-10-16) and defaults

- One contract per game; a unique collectible per claim; tradeable; platform-only admin; platform deploys and pays; limit per
  milestone only; builder vector art with a pixel-sprite fallback (all in ADR-018 Amendment 3).
- **Defaults taken here, review at merge:** milestones are defined once and never edited (limit and drawing); the milestone key is the
  first 16 bytes of the SHA-256 of the id, little endian (`rewards_core::key`, shared vectors in `abi/milestone-key-vectors.json`);
  edition numbers are per milestone across all wallets; the drawing limit is set at initialise, not compiled in; `pause` is the only way
  to stop a game (no retire); the claimant is output 0's script (the runtime hides spent outputs).
- **Structure:** rules in `rewards-core` (native, measured), runtime glue in thin contracts, one `responder-kit` for the answer
  helpers, opcodes written once (`rewards_core::opcode`) and checked against `abi/*.json`. The old spike directory is gone.

## What the checks found

- A harness bug that hid wrong results: transactions with the same inputs, outputs and call have the same id and traces are keyed by id,
  so repeated claims shared one trace. Every harness transaction now spends its own made-up output.
- Mutation proof (31 mutants over policy, drawing validation, holder, key, picture, and every contract operation): 29 killed at once. One
  was an equivalent mutant (`"<scrip"` is a prefix of `"<script"`), replaced by `"<scrxpt"` and killed. One was a real gap: a nested
  `<svg>` that is closed once was not tested, so the single-document check could be removed unnoticed; a test case now covers it and the
  mutant is killed.
- The first sprite cost about 688,000 fuel to read; drawing bars as runs with a hand-written number writer brought it to about
  446,000 (a drawn picture about 196,000). `collectible.rs` guards both.
- `find_witness_payload` does not decompress, so a drawing must travel in an uncompressed envelope; a compressed one is stored as gzip.

## Not done (tasks created)

- #75 the adapter's reads, #76 build, deploy, broadcast and observe (needs wallet signing), #77 the SVG sanitiser.
- A transfer lock (impossible on this runtime), retire, per-game totals, and explorer rendering of SVG from `get-data` (unverified).

## Gates (run 2026-10-16)

- `contracts/templates/ci.sh lint` (fmt, clippy `-D warnings` on wasm32 and native): pass. `typecheck`: pass.
- `ci.sh test`: `rewards-core` 30 unit and 3 ABI tests pass; harness 23 tests pass (admin 5, claims 6, collectible 5, milestones 6, transfer 1).
- `ci.sh hashes`: both code hashes equal `release.json` (a second build into a different target directory gave the same hashes).
  `game-rewards` 293,662 bytes, `milestone-collectible` 237,471 bytes.
- `ci.sh coverage` (`rewards-core`): 98.64% regions, 100% functions, 99.50% lines; stable Rust gives no branch counts. The contract crates
  are wasm-only and covered by the harness instead.
- `pnpm contracts:lint`, `pnpm contracts:typecheck`, `pnpm format:check`, `pnpm repository:check` (48 workspaces, 1625 files): pass.
  The web build, TypeScript typecheck and e2e were not rerun: no TypeScript changed.
- The longest new Rust file is 203 lines.
