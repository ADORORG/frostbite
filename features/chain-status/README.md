# `@ador/feature-chain-status`

How far the rewards chain's indexer has read, as one public route and a lamp any page can show.

## Purpose

A platform record is only as current as the chain's indexer: a transaction in a block is "confirmed" for the platform only once the
indexer has run it (ADR-018). This feature tells anyone whether the indexer is keeping up, and the same reading decides when a
step or claim is called delayed (`@ador/chain/indexing`, `isDelayed` in `@ador/shared/chain`).

## Public API

- `createChainStatusFeature(config)` (package root): the registration for `configs/features.ts`. Declares the route
  `GET /api/v1/chain/indexing` (public, no input) and no page.
- `@ador/feature-chain-status/badge`: `<IndexingBadge refreshMs />`, a client component. It draws nothing until the platform answers,
  asks again every `refreshMs` (not while the tab is hidden), draws nothing where the platform follows no chain, and says
  "Chain status unknown" when the platform cannot be reached. The app places it in the header through `ShellStatusProvider` in the layout.
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
