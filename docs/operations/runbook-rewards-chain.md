# Runbook: the rewards chain (signet)

How a deployment is pointed at the chain its games' rewards contracts live on, and how to turn it on and off. The settings are
`REWARDS_*` in `.env.example`; the rules (dust, claim output, fee target, signing window, the templates and their released code
hashes, the release gate) are `configs/rewards-policy.ts`; the assembly is `configs/rewards-chain.ts`.

Where each template and each game's contract is on the chain is **not configuration**. Staff publish and create them from the
Game rewards page, and the platform records them when each step completes (`ador.published_templates`, `ador.game_contracts`).

## Turn it on

1. `REWARDS_CHAIN_RPC_URL`: one JSON-RPC address serving the Bitcoin (`esplora_*`) and Alkanes (`metashrew_*`) methods. Signet is
   the only chain wired today (`configs/chains.ts`). Blank means no rewards chain: claims and staff administration say
   "not available".
2. `REWARDS_MAX_FEE_SATS`: the most one claim or step may pay in fee. Required with the address; boot stops without it.
3. `REWARDS_CHAIN_RPC_TIMEOUT_MS` (optional): how long a call to the node may take. Blank means 15 seconds.
4. `REWARDS_TEMPLATES_DIR` (optional): the folder holding `game-rewards.wasm` and `milestone-collectible.wasm`, built with
   `contracts/templates/build.sh`. Without it staff cannot publish templates or create games, and the page says so. A file whose
   SHA-256 differs from `contracts/templates/release.json` is refused before anything is built.

Restart the web process after changing any of these. A malformed value stops boot with the name of the setting.

The release gate is `signetReleaseGate` in `configs/rewards-policy.ts` (signet: open). While a chain's gate is closed it is
configured but not offered: nothing is built, sent or watched on it. Mainnet is not wired; opening its gate is the owner's decision
after a review.

## First use, from the staff page (`/admin/games`)

1. Enter the wallet address you will sign with.
2. Publish `game-rewards@1.0.0` and `milestone-collectible@1.0.0`: type the address each goes to (`4:n`, an id nothing else uses),
   prepare the step, read the summary, sign, send. The template appears as published when the step completes.
3. Open a game, enter the largest drawing its contract should keep (it cannot be changed), create the contract, sign, send. The
   page shows the contract's address once the chain reports it.
4. Define the game's milestones and pause or resume claims as before.

A step is complete only after the indexer has run it. If a creation confirms but the chain does not report the new contract, the
step fails to index and nothing is recorded; the contract may exist on chain, so check before creating another.

## Before the first step

Check the node's indexer is keeping up: `metashrew_height` against `esplora_blocks:tip:height`. A step is confirmed only
after the indexer ran it (ADR-018), so a lagging indexer holds every step at "sent". On 2026-10-16 the public signet endpoint's
indexer was about 1,000 blocks behind and not moving (finding S73).

## Turn it off

Blank `REWARDS_CHAIN_RPC_URL`, or close the chain's gate in the policy, and restart. Steps and claims already sent stay on the chain
and in the log; nothing new is built or sent, and the pages say it is not available.
