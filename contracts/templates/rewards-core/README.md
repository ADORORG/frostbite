# rewards-core

Every rule of the game-rewards templates that does not need the Alkanes runtime, so it runs and is
measured natively. The two contracts call it; they hold no rules of their own.

- **Public API:** `policy` (`check_claim`, `check_definition`, `Refusal` and its on-chain texts), `art`
  (`validate`), `holder` (`Holder`), `render` (`frame::picture`, `sprite`, `text`, `CONTENT_TYPE`),
  `attributes::json`, `opcode` (the opcode numbers of both contracts).
- **Dependencies:** `sha2` only. No clock, no network, no runtime.
- **Configuration:** none; limits such as the drawing size arrive as arguments.
- **Invariants:** a refusal's text is what the chain records; the opcode constants equal the published
  ABI files (`tests/abi.rs`); the sprite is deterministic per milestone and mirrored.
- **Tests:** `cargo test -p rewards-core`; coverage with `../ci.sh coverage` (above 90%).
- **Owner:** contract engineering. See `../README.md`.
