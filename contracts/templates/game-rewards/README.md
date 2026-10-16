# game-rewards@1

One contract per game: players claim milestones and receive a collectible; the platform's auth token
defines milestones and pauses claims. ABI: `../abi/game-rewards@1.json`; opcode numbers in
`rewards_core::opcode::game`.

- **Modules:** `admin` (initialise, pause, resume), `milestones` (define, with the drawing from the
  witness), `claim`, `claimant` (who a claim counts for), `views`, `state` (storage keys, in one place).
- **Dependencies:** `rewards-core`, `responder-kit`, `alkanes-runtime`, `alkanes-support`.
- **Configuration:** at `initialize`: the collectible template id and the largest drawing in bytes.
  Per-milestone limits arrive with `define_milestone`; nothing is compiled in.
- **Invariants, limits and threat model:** `../README.md`.
- **Tests:** `../harness` (`admin`, `milestones`, `claims`, `collectible`, `transfer`).
- **Owner:** contract engineering.
