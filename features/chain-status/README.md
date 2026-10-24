# `@ador/feature-chain-status`

How far the rewards chain's indexer has read, and what it costs to be confirmed on it, as two public routes, a lamp and a panel any page can show, and the one fee speed picker any step can use.

## Purpose

A platform record is only as current as the chain's indexer: a transaction in a block is "confirmed" for the platform only once the
indexer has run it (ADR-018). This feature tells anyone whether the indexer is keeping up, and the same reading decides when a
step or claim is called delayed (`@ador/chain/indexing`, `isDelayed` in `@ador/shared/chain`).

## Public API

- `createChainStatusFeature(config)` (package root): the registration for `configs/features.ts`. Declares the routes
  `GET /api/v1/chain/indexing` and `GET /api/v1/chain/fees` (public, no input) and no page.
- `@ador/feature-chain-status/badge`: `<IndexingBadge refreshMs />`, a client component. It draws nothing until the platform answers,
  asks again every `refreshMs` (not while the tab is hidden), draws nothing where the platform follows no chain, and says
  "Chain status unknown" when the platform cannot be reached. The app places it in the header through `ShellStatusProvider` in the layout.
- The badge also opens a panel one click beside the lamp: the latest block and, for each fee speed (slow, medium, fast, lightning),
  the chain's rate, the approximate wait and, only where the page knows the size of a transaction already built, what it would pay. No cost is told for a size that is only assumed. Where the chain or the
  platform cannot be asked it says "Fees unknown" and draws no rate.
- `@ador/feature-chain-status/fee-picker`: `<FeeSpeedPicker market value onChange vbytes? maxFeeSats?>` and `useFeeQuotes({ refreshMs })`,
  the one control any step that pays a fee uses (staff steps and a player's claim today; minting next). It shows the four speeds with their
  wait and rate, an optional cost for a transaction of `vbytes`, refuses a speed above `maxFeeSats` with the reason, never offers a speed the server marked `withinLimit: false` (the chain quotes more for it than any step, even a small one, may pay: the platform's `maxFeeSats`, told in the `/fees` answer, against the smallest step, `smallestStepVbytes`, which is never shown as a cost; the header panel marks those rows too), and says plainly
  when the market is unknown. The choice is the speed, never the rate: the speed travels on the intent (`feeSpeed`) and the adapter
  quotes the rate for its block target when it builds the transaction. Other features import only this subpath.
- `<CostOverview asset baseUnits detail?>` (same entry): the cost of a built transaction, told wherever a person is about to act on the chain. A fee in satoshis (`btc`) is shown as sats, then the rate it was priced at, the speed with its wait and about how large the transaction is (fee ÷ rate); any other asset is its amount and name. `detail` is the `feeDetail` the builder put on the summary.
- The lamp itself is the shared `StatusLamp` (`@repo/ui/arcade`) in its compact form, so another status (a queue, a provider) reuses it.

## Answers

`none` (no chain followed: nothing is shown), `unavailable` (a chain is followed and could not be asked: neutral, never green and never
"behind"), `ok` with `health` `current`, `catching-up` (within `delay.maxLagBlocks`) or `delayed`, and the heights.

## Dependencies and configuration

`ChainStatusConfig` (`configs/chain-status.ts`): the followed chain (name and a reading that rejects when the node cannot be asked), `delay.maxLagBlocks`
and `refreshMs` from `rewardsPolicy`. The reading is cached by `cacheIndexing` in the rewards chain's observer, so the node is asked at most
once per `rewardsPolicy.indexingReadingMs` however many pages poll, and the services share the same reading. It owns no environment
variables, tables or provider code.

## Invariants

- A chain that cannot be asked is never reported as in sync or as behind.
- "Delayed" is a statement about the wait, never about the outcome.
- Removing the one registration in `configs/features.ts` and the `IndexingBadge` in the layout removes the feature.

## Verification

`pnpm --filter @ador/feature-chain-status typecheck test:unit test:integration test:coverage`. Platform engineering owns it.

## The header and the fee controls

- `NetworkPill` (via `@ador/feature-chain-status/badge`) is the chain in the header: a light, the network's name and its latest block; opened, how far the platform has read the chain and the four fee speeds as tiles. Nothing is drawn where no chain is followed, and an unknown is shown as unknown.
- `FeeSpeedChip` (`@ador/feature-chain-status/fee-picker`) is the speed chosen as one small control that opens the tiles (`FeeSpeedPicker`). A speed marked `withinLimit: false` by the server is never offered. Staff pages and the player's claim use it.
