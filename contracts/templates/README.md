# Contract templates: game rewards

Versioned Alkanes contracts that mint a milestone collectible (ADR-018 Amendment 3). Plan section 9.2
lists what a template release must contain; this table says where each item is.

| Release item                       | Where                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Rust source                        | `game-rewards/`, `milestone-collectible/`, with `rewards-core/` and `responder-kit/`   |
| Pinned lockfile                    | `Cargo.lock` (the `alkanes-rs` revision's own lock; newer crates need Rust above 1.86) |
| Reproducible WASM build, code hash | `build.sh` (pinned toolchain, `--locked`, path remapping); hashes in `release.json`    |
| ABI / operation schema             | `abi/game-rewards@1.json`, `abi/milestone-collectible@1.json`                          |
| Tests                              | `rewards-core/` (native), `harness/` (the Alkanes indexer, `index_block`)              |
| Threat model and limits            | this file                                                                              |
| Generated TypeScript client        | not yet: tasks #75 and #76 build the adapter from the ABI files                        |

## What a game gets

One `game-rewards` instance per game, created from the one audited template, and one
`milestone-collectible` template shared by every game.

1. The platform deploys the two templates once (`{3, id}`), then each game's instance (`{1, 0}`) and
   calls `initialize(collectible_template, max_art_bytes)`. The auth token comes back to the caller:
   whoever holds it administers the game (D19: the platform).
2. With the auth token, the platform defines each milestone from the game's manifest:
   `define_milestone(milestone, limit)`, with the milestone's drawing, if any, in the witness. A
   milestone is defined once and never edited.
3. A player's wallet calls `claim(milestone)`. The contract counts the claim for that wallet (limit
   per wallet and milestone, ADR-018 Amendment 3), numbers it within the milestone, creates a
   `milestone-collectible` from the template and returns it, so it lands in the claiming
   transaction's output.
4. A page shows the item by reading `get-data` (the picture), `get-content-type` and
   `get-attributes` from the collectible.

`pause` stops claims; `resume` reopens them. Definitions and limits are not editable.

## Layout (one purpose per crate and module)

| Crate                   | Purpose                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rewards-core`          | Every rule that does not need the Alkanes runtime: claim and definition policy and its refusal texts (`policy`), drawing validation (`art`), the holder digest (`holder`), the picture (`render`), attributes JSON, and the opcode numbers (`opcode`). Runs natively; its coverage is measured. |
| `responder-kit`         | How a call answers (`forwarded`, `answer`, `number`), written once for both contracts.                                                                                                                                                                                                          |
| `game-rewards`          | `admin`, `milestones`, `claim`, `claimant`, `views`, and `state` (the only place storage keys are named).                                                                                                                                                                                       |
| `milestone-collectible` | `state` and `views`; the item stores its issuer, milestone and edition and builds its picture when read.                                                                                                                                                                                        |
| `harness`               | Tests through the Alkanes indexer; see `harness/README.md`.                                                                                                                                                                                                                                     |

## Invariants

- A wallet claims a milestone at most `limit` times; the count and the check live in the contract.
- Edition numbers within a milestone are unique and consecutive; a refused claim consumes none.
- Only the auth token's holder defines milestones, pauses and resumes; the token always comes back.
- A defined milestone's limit and drawing never change.
- A drawing is one SVG document, within `max_art_bytes`, with no script, `foreignObject`, iframe,
  entity or doctype (checked on chain; the platform sanitises first).
- The contract holds no funds and never trusts the caller to say who the player is.

## Known limits (read before relying on it)

- **Claimant.** The runtime does not show a contract the outputs a transaction spends
  (`AlkaneResponder::output` is commented out upstream), so the claimant is the script output 0 pays to.
  Someone can claim for another wallet: the other wallet receives a free collectible and uses one of
  its claims. Accepted for self-reported milestones. The platform shows "claimed" only for the wallet
  the player signed in with.
- **No transfer lock.** The runtime moves balances without calling the contract
  (`harness/tests/transfer.rs`). Holding a collectible never proves the holder earned it.
- **Issuer.** Anyone can create an instance of the collectible template, so a collectible is genuine
  only if its issuing game (named by `get-attributes`) is one the platform lists.
- **Admin.** Losing the auth token means no further milestones and no pause. There is no retire; pausing
  is the way to stop a game.
- **Witness envelope.** A drawing travels in an uncompressed ordinals-style envelope in the witness of
  the `define_milestone` transaction. `find_witness_payload` does not decompress, so a compressed
  envelope stores gzip bytes (and fails validation).
- **Cost.** Reading a drawn picture costs about 196,000 fuel and a sprite about 446,000
  (`harness/tests/collectible.rs` guards both).
- **Explorers.** Opcodes 1000 to 1002 follow the Orbital convention; whether a given explorer renders
  SVG from `get-data` is unverified.

## Chain-neutral mapping (adapter pattern)

The platform speaks neutral operations (`deploy`, `mint-milestone`, `RewardsReader.claimed`). Only the
`bitcoin-alkanes` adapter knows this contract:

| Neutral operation       | Alkanes realisation                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `deploy` of a template  | the template's wasm in a witness envelope, `{3, id}` for a template, `{1, 0}` plus `initialize` for an instance |
| `mint-milestone`        | a protostone calling `claim(milestone key)` in a transaction whose output 0 pays the claimant                   |
| `RewardsReader.claimed` | view `get_claimed(holder halves, milestone key)`                                                                |
| observing a claim       | the trace of the claim transaction's protostone (revert text = `Refusal::message()`)                            |
| a milestone's id        | `milestone_key(id)` (u128), the same function in Rust and in the adapter                                        |

Another chain adapts its own contract to the same ports; nothing above the adapter names an opcode.

## Commands

From the repository root: `pnpm contracts:lint`, `pnpm contracts:typecheck`, `pnpm contracts:test`
(builds both contracts, runs `rewards-core` natively and the harness, then checks the code hashes), and
`pnpm contracts:coverage`. Directly: `contracts/templates/ci.sh lint|typecheck|hashes|test|coverage` and
`contracts/templates/build.sh [--check|--write]`.

Needs `wasm-bindgen-test-runner` 0.2.100 and `cargo-llvm-cov` 0.6.21.

Coverage: `rewards-core` is measured (lines, functions, regions above 90%; stable Rust reports no
branch counts). The contract crates build only for wasm32, where line coverage cannot be collected,
so they hold no rules of their own and every operation and refusal is exercised through the harness
instead. A change to a contract needs a harness test and a mutation check.

## Releasing a changed template

A deployed template's code hash must not change. Any change to contract code, `rewards-core`,
`responder-kit`, the lockfile or the profile changes `release.json`: bump the template version, add
new ABI files, and run `build.sh --write`. `pnpm contracts:test` fails on a changed hash.

Owners: product and contract engineering.
