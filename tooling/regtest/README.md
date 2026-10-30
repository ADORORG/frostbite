# `@repo/regtest`

A local Bitcoin regtest chain with a real Alkanes indexer, for running the platform's on-chain steps (publish a template, create a
game's contract, define a milestone, claim) with nothing simulated. It exists because the public signet indexer is not reliable
(findings S73, S78).

## What it starts

| Piece                              | How                                                         | Port (loopback only) |
| ---------------------------------- | ----------------------------------------------------------- | -------------------- |
| Bitcoin Core, regtest, with wallet | Docker, `ruimarinho/bitcoin-core:24`                        | 18443                |
| Alkanes indexer                    | `rockshrew-mono` running a regtest `alkanes.wasm`           | 18080                |
| Gateway                            | `src/gateway.ts`: one URL for both, as the platform expects | 18081                |

The platform reads a chain through one JSON-RPC URL that answers Esplora's names and Metashrew's. The gateway answers the eight the
adapter uses (`esplora_blocks:tip:height`, `…:tip:hash`, `esplora_fee-estimates`, `sendrawtransaction`, `esplora_tx`,
`esplora_address::utxo`, `metashrew_height`, `metashrew_view`) from Core and the indexer, and refuses anything else.

## Use

```sh
tooling/regtest/scripts/build-indexer.sh        # once; builds rockshrew-mono and the regtest alkanes.wasm (15 to 20 minutes)
pnpm --filter @repo/regtest regtest up          # start everything, mine the first 101 blocks
pnpm --filter @repo/regtest regtest status      # chain height and indexed height
pnpm --filter @ador/chain test:regtest          # run the real lifecycle against it
pnpm --filter @repo/regtest regtest down        # stop; add --wipe to forget the chain and the indexer's database
```

Other commands: `address`, `mine <n>`, `fund <address> <btc>`, `sign-psbt <base64>` (the node's wallet signs and finalises what
it owns, which is what a wallet does for a step). Point `REWARDS_CHAIN_RPC_URL` at `http://127.0.0.1:18081` to use it from the app.

## Settings the stack chooses, and why

- `--reorg-check-threshold 0`: with the host's default (6) the indexer re-fetches the last block over and over within six blocks of
  the tip and stops advancing (finding S78).
- `--view-memory-floor-mb 1024`: the host refuses view calls when the machine has under 8 GB free by default.
- Fee estimates are fixed (regtest has no fee market).
- Core's credentials are throwaway values; the node is reachable from this machine only.

## Limits

The gateway lists an address's unspent outputs from Core's set, so an output still in the mempool is not listed: mine a block
between steps that spend each other's outputs. State lives in `.regtest/` (ignored by git).

## Ownership

Platform engineering.
