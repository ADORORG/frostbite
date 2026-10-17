# Templates and contracts are learned from the chain (G7g-2)

Branch `feat/g7g-2-onchain-records` (from `feat/g7g-signet-config`). Part of #73. Follows the owner's objection (2026-10-17) to listing template
ids and game contracts in settings: "we have to deploy before we can figure out the ids", and "100 games means 100 fields".

## What changed

- **Settings:** `REWARDS_CHAIN_RELEASE_GATE`, `REWARDS_TEMPLATE_IDS` and `REWARDS_CONTRACTS` are gone (definitions, all eight env files, parser,
  tests, runbook). Four remain: node address, fee ceiling, timeout, templates folder. The release gate is `signetReleaseGate` in
  `configs/rewards-policy.ts` (signet open; a mainnet record would be added closed).
- **Where things are is recorded:** `ador.published_templates` and `ador.game_contracts` (migration `20261017010458_game_contracts`), written in
  the same transaction that completes the step that made them (`@ador/database/game-contracts`). Never updated; unique per template/game and
  per address; the step that made each is kept as evidence (`ON DELETE RESTRICT`). `game_admin_steps` now takes steps that belong to no game
  (publishing a template) and steps that act on no contract yet (publishing, creating), with checks that keep each operation coherent.
- **Neutral intent and summary:** `publish-template` carries `templateAt`; `deploy` carries `templateAt`, `collectibleAt`, `maxDrawingBytes`; the
  summary shows them and the verifier rebuilds the call from the summary. Observations carry `created` (contracts the trace created).
- **Adapter:** template addresses and the drawing size travel in the step; published code must be in block 4; the size is held to the platform
  ceiling. `decodeTraceCreated` reads the contract a creation made from the indexer's trace; the fixture is the indexer's own recording
  (`abi/trace-vectors.json`, `creation`: game `2:1`, then its auth token `2:2`). The `success` vector was re-recorded (fuel differed).
- **Service:** `publish-template` and `deploy` actions; refusals `unknown-template`, `already-published`, `address-taken`,
  `template-not-published`, `already-created`; `status(gameId)` and `templates()`; completing a step records what it made, or fails to index
  when the chain did not say what a creation made.
- **Claims** read a game's contract from the record (`game()` is async in both services).
- **Page:** `/admin/games` has the templates (publish each at an address staff type); a game's page offers "Create the contract" once both
  templates are published, and shows pause/milestones only once the record has the contract. Review shows template, collectible address,
  drawing size and what the network reports it created.

## Verification

- Mutation proof: game-admin service/repository 20 mutants plus 6 database store mutants, chain adapter 15, simulated chain 3, shared 5,
  config 5; survivors found and closed with tests; one equivalent (game and collectible templates share read-only opcode 99).
- Real indexer: the creation trace is the harness's recording (`cargo test --test trace_vectors`, 2 passed).
- Playwright `game-admin.spec.ts` (four viewports, axe, keyboard, reduced motion, baselines) updated; baselines read.
- Gates: see the final report of the session.

## Not built, and said so

- No wallet signs steps (staff paste); no live run against signet (the public endpoint's indexer is stalled, finding S73).
- A creation that confirms but whose contract cannot be read fails to index and records nothing; the contract may exist on chain. There is
  no way yet to record it by hand.
- "Delayed" display still not built. `ChainConfig.confirmations` is still not read by any service.
