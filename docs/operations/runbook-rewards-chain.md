# Runbook: the rewards chain (signet or testnet4)

How a deployment is pointed at the chain its games' rewards contracts live on, and how to turn it on and off. The settings are
`REWARDS_*` in `.env.example`; the rules (dust, claim output, fee target, signing window, the templates and their released code
hashes, the release gate) are `configs/rewards-policy.ts`; the assembly is `configs/rewards-chain.ts`.

Where each template and each game's contract is on the chain is **not configuration**. Staff publish and create them from the
Game rewards page, and the platform records them when each step completes (`frostbite.published_templates`, `frostbite.game_contracts`).

## Turn it on

1. `REWARDS_CHAIN_RPC_URL`: one JSON-RPC address serving the Bitcoin (`esplora_*`) and Alkanes (`metashrew_*`) methods. The node must serve the
   beta's test network, `BETA_NETWORK` (`signet`, the blank default; or `testnet4`, ADR-019); `pnpm testnet:preflight`
   reads the node's genesis block and fails if it is the other chain, which the addresses alone would not show. Blank means no rewards chain: claims and staff administration say
   "not available".
2. `REWARDS_MAX_FEE_SATS`: the most one claim or step may pay in fee. Required with the address; boot stops without it. The `game-rewards` template is 294 KB, which costs about 150,000 sats to publish at 2 sat/vB, so the ceiling must be above that (finding S78): 500000 suits signet. Tighten it before any real network.
3. `REWARDS_CHAIN_RPC_API_KEY` and `REWARDS_CHAIN_RPC_API_KEY_HEADER` (optional, together): for a gateway that wants a key, the key
   and the name of the HTTP header that carries it (its documentation says which). They are sent with every call, from the server only.
   One without the other stops boot. Keep the key out of `REWARDS_CHAIN_RPC_URL`, which is logged by host only but is easier to leak.
4. `REWARDS_CHAIN_RPC_TIMEOUT_MS` (optional): how long a call to the node may take. Blank means 15 seconds.
5. `REWARDS_TEMPLATES_DIR` (optional): the folder holding `game-rewards.wasm` and `milestone-collectible.wasm`, built with
   `contracts/templates/build.sh`. Without it staff cannot publish templates or create games, and the page says so. A file whose
   SHA-256 differs from `contracts/templates/release.json` is refused before anything is built.
6. **Where the fee rate comes from.** Every step needs a fee rate, and the platform takes it from a public explorer, never from the
   node's own estimates, which on the hosted test networks are absurd (hundreds of sat/vB on signet, hundreds of thousands on
   testnet4). Two optional settings:
   - `REWARDS_FEE_API_FORMAT`: which explorer. `mempool` (the default when blank) is mempool.space's own recommended fees;
     `blockstream` is Blockstream's Esplora, an estimate per confirmation target. Each adapter carries its own address for the
     network (`BETA_NETWORK`), in `packages/chain/src/fee-sources/adapters.ts`; there is no address to set. Blockstream's signet
     estimates have been far too high (about 149 sat/vB for most targets), so look at the numbers before choosing it there.
   - `REWARDS_FEE_RATE_SAT_VB`: the fallback (up to 1000, a fraction is fine). When the chosen explorer cannot be read (unreachable,
     an error status, or an answer that is not a fee table), this rate is used for every step and every speed, and the server logs
     `The fee source <name> could not be read (<reason>); REWARDS_FEE_RATE_SAT_VB is used.` each time. It is yours to keep honest: it
     does not follow the network, so a rate that is too low leaves a step unconfirmed and one that is too high wastes fee. Each
     step's total fee is still held to `REWARDS_MAX_FEE_SATS`. Without it a step fails with "The fee source could not be reached."
     (a claim shows "The network could not be reached"); nothing is guessed.

   **Looked at when the server starts.** With no fallback rate set, the server asks the chosen explorer once as it starts and reads
   every level. If it cannot be reached or does not answer as that explorer does, the server does not start and says so:
   `REWARDS_FEE_API_FORMAT (<name>) is not usable: <reason>`. Choose another, or set a fallback rate. With a fallback rate the server
   starts without looking, since a step is priced either way.

To move a deployment between test networks, set `BETA_NETWORK`, make `REWARDS_CHAIN_RPC_URL` (and the key) point at a node of that
network, apply migrations (`wallet_network_testnet4` widens the wallet network checks), run the preflight, restart, and connect a
wallet set to the same network. Games, collections and records made on the other network stay on it (their chain ids differ).

Restart the web process after changing any of these. A malformed value stops boot with the name of the setting.

The release gate is `testChainReleaseGate` in `configs/rewards-policy.ts` (the beta's test network: open). While a chain's gate is closed it is
configured but not offered: nothing is built, sent or watched on it. Mainnet is not wired; opening its gate is the owner's decision
after a review.

## First use, from the staff page (`/admin/games`)

1. Connect Xverse, UniSat or OYL from the wallet button in the header (the policy list `signingWallets` in
   `configs/rewards-policy.ts`). The page then offers that wallet's address and signs with it: each step opens a review, and the
   wallet asks you to approve it. Without a connected wallet from that list, enter the address you will sign with, sign elsewhere
   and paste the result. The wallets are not yet qualified with evidence (finding S77): try a template publish first, and treat a
   refusal by the wallet or by the platform's check as information, not as a fault to bypass.
2. Publish `game-rewards@1.0.0` and `milestone-collectible@1.0.0`: prepare the step, read the summary (it shows the address the platform
   chose, `4:n`: the first number from `rewardsPolicy.templateSequence` that has no code on the chain and that no recorded template, game
   contract or template step still to be sent holds), sign, send. The template appears as published when the step completes. Two staff
   preparing different templates in the same moment could be given the same address; the second to complete is refused when the platform
   records it, and prepares again.
3. Open a game, enter the largest drawing its contract should keep (it cannot be changed), create the contract, sign, send. The
   page shows the contract's address once the chain reports it.
4. Define the game's milestones and pause or resume claims as before.

A step is complete only after the indexer has run it. If a creation confirms but the chain does not report the new contract, the
step fails to index and nothing is recorded; the contract may exist on chain, so check before creating another. In that case the
step's details show "Contract address": find the contract on a block explorer and enter its address. The platform checks that a
contract is there and is made from the game template (same code hash) and that the address is not already a template or another
game's contract; only then does it record the address and complete the step, and the log says who entered it. A refusal says why
and records nothing. (That an instance reports its template's code hash is the assumption to confirm on the first live creation; if
the check refuses a real contract, nothing is recorded wrongly, and the finding is logged.)

## Before the first step

Check the node's indexer is keeping up: `metashrew_height` against `esplora_blocks:tip:height`. A step is confirmed only
after the indexer ran it (ADR-018), so a lagging indexer holds every step at "sent". On 2026-10-16 the public signet endpoint's
indexer was about 1,000 blocks behind and not moving (finding S73).

## The platform fee on mints

Staff set what the platform charges on each milestone mint on `/admin/games` ("Platform fee"): the fee in satoshis and the treasury
address it is paid to, saved together. The player pays it on top of the network fee, sees it and the total before signing, and it goes
to the treasury as an extra output of the claim's transaction. 0 turns it off. The platform refuses an address that is not on the
game's network, a fee under the dust limit of that address, and one above the policy maximum (`rewardsPolicy.maxPlatformFeeSats`).
A change applies to claims started after it. A game's page shows its mints and the fees accrued; the list shows the same for every
game. Fees are counted when a claim is complete, never before.

If every claim stops with "not supported" after a change, look at the treasury address: a fee that is set and unusable stops the
claim rather than letting it through without the fee. Set a valid address (or a fee of 0).

## Reading the lamp and "delayed"

Every page has a small lamp in its header (nothing shows where no rewards chain is configured). **Chain in sync**: the indexer has read every
block. **n blocks behind**: normal catching up (up to 2 blocks). **Delayed, n blocks behind**: more than 2 blocks behind; hover or focus the lamp for
the heights. **Chain status unknown** (grey): the platform could not ask the node, which is not the same as the indexer being behind.

A step or claim that is sent and waiting turns "Sent, delayed" or "Confirmed, delayed" when the indexer is more than 2 blocks behind or it was
sent more than 60 minutes ago (`delay` in `configs/rewards-policy.ts`). Delayed is never failed: nothing is cancelled or retried, and it
completes when the indexer catches up and the chain's records agree. The wait is counted from when the network first answered with the transaction's id
(`broadcast_at`). If the node cannot be asked, only the 60 minutes can mark a wait delayed. The lamp refreshes every 30 seconds
(`indexingRefreshMs`), and the platform asks the node at most once per 15 seconds (`indexingReadingMs`) however many pages are open.

## Checking the setup before the first run

`pnpm testnet:preflight` (optionally `--env <file>`, default `apps/web/.env.local`) reads the settings and checks, without signing or sending anything:
the `REWARDS_*` settings parse as the platform parses them; each template in `REWARDS_TEMPLATES_DIR` has the released hash; the indexer is within
the allowed lag of the tip; the auth-token factory (`4:65517`) has code; and the estimated cost of publishing each template at the quoted fee rate is
within `REWARDS_MAX_FEE_SATS`. `UNVERIFIED` means the node could not be asked (for example a stalled indexer), not that the check passed. Exit code 0
means all passed, 1 something is wrong, 2 only unverified. It does not cover broadcast acceptance, wallet signing or the staff account and manifest.

## Turn it off

Blank `REWARDS_CHAIN_RPC_URL`, or close the chain's gate in the policy, and restart. Steps and claims already sent stay on the chain
and in the log; nothing new is built or sent, and the pages say it is not available.

## Trying the steps on a local regtest chain

When the public signet indexer is stalled, `tooling/regtest` runs a real chain on this machine (Bitcoin Core in Docker and the Alkanes indexer):
`tooling/regtest/scripts/build-indexer.sh` once, then `pnpm --filter @repo/regtest regtest up`, and point `REWARDS_CHAIN_RPC_URL` at
`http://127.0.0.1:18081`. `pnpm --filter @frostbite/chain test:regtest` runs the whole lifecycle against it. See the package README. The
platform treats the chain as `regtest` only in the adapter so far; wiring a regtest chain into the app's configuration and the
games' manifests is not done.
