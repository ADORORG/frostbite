# Runbook: the rewards chain (signet)

How a deployment is pointed at the chain its games' rewards contracts live on, and how to turn it on and off. The settings are
`REWARDS_*` in `.env.example`; the rules (dust, claim output, fee target, signing window, the templates and their released code
hashes) are `configs/rewards-policy.ts`; the assembly is `configs/rewards-chain.ts`.

## Turn it on

1. `REWARDS_CHAIN_RPC_URL`: one JSON-RPC address serving the Bitcoin (`esplora_*`) and Alkanes (`metashrew_*`) methods. Signet is
   the only chain wired today (`configs/chains.ts`). Blank means no rewards chain: claims and staff administration say
   "not available".
2. `REWARDS_MAX_FEE_SATS`: the most one claim or step may pay in fee. Required with the address; boot stops without it.
3. `REWARDS_CHAIN_RELEASE_GATE=open`. Blank or `closed` configures the chain but offers nothing on it: no building, sending or
   watching. Mainnet is not wired; opening a gate is the owner's decision after review.
4. Templates (staff publishing templates and creating games): build them with `contracts/templates/build.sh`, then set
   `REWARDS_TEMPLATES_DIR` to the directory holding `game-rewards.wasm` and `milestone-collectible.wasm`, and
   `REWARDS_TEMPLATE_IDS` to the Alkane each is published at, for example
   `{"game-rewards":"4:100","milestone-collectible":"4:101"}`. The ids are chosen by the owner and must be free on the chain.
   A file whose SHA-256 differs from `contracts/templates/release.json` is refused before anything is built.
5. A game's deployed contract: `REWARDS_CONTRACTS`, for example `{"my-game":{"id":"4:200","maxDrawingBytes":4096}}`. Add it
   once staff have created the game's contract; the byte limit is the one it was created with.

Restart the web process after changing any of these. A malformed value stops boot with the name of the setting.

## Before the first step

Check the node's indexer is keeping up: `metashrew_height` against `esplora_blocks:tip:height`. A step is confirmed only
after the indexer ran it (ADR-018), so a lagging indexer holds every step at "sent". On 2026-10-16 the public signet endpoint's
indexer was about 1,000 blocks behind and not moving (finding S73).

## Turn it off

Blank `REWARDS_CHAIN_RPC_URL`, or set `REWARDS_CHAIN_RELEASE_GATE=closed`, and restart. Steps and claims already sent stay on
the chain and in the log; nothing new is built or sent, and the pages say it is not available.
