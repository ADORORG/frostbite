# The "delayed" display and the indexing lamp (G7j)

Branch `feat/g7j-delayed-display`, on top of `feat/g7i-regtest`; baseline `b5fb128`. Decision: ADR-018 (indexer more than 2 blocks behind, or 60
minutes unconfirmed: "delayed", never "failed"). Owner asked for a reusable indexing-status component, probably on the navbar.

## What was built

- **One rule** (`isDelayed`, `indexingHealth`, `lagOf`, `sentAtAfter`; `@ador/shared/chain/indexing`). Policy values in `rewardsPolicy.delay`
  (`maxLagBlocks` 2, `maxUnsettledMs` 60 minutes), `indexingReadingMs` (15 s) and `indexingRefreshMs` (30 s).
- **Reading the indexer:** `ChainObserver.indexing(chain)` (a new method on the neutral port; the bitcoin-alkanes adapter answers from the tip and
  `metashrew_height`, the simulated chain says in sync). `@ador/chain/indexing`: `readIndexing` (null where the chain cannot be asked),
  `cacheIndexing` (one reading per chain per `ttl`, shared by callers in flight, failures never kept), `createDelayJudge` (one reading per chain
  with a wait on it, none when nothing waits; time alone where the chain cannot be asked).
- **Send time:** `broadcast_at` on both tracked tables (migration `20261017195259_game_tracked_broadcast_at`, with a check that it is set exactly when
  the transaction id is, and a backfill from `updated_at`). Both repositories set it once, through `sentAtAfter`.
- **Services:** `createStepViewer` (game-admin) and `createClaimViewer` (game-claims) add `delayed` and `sentAt` to every view they hand out.
- **Wire:** `delayed` and `sentAt` on the staff step and the player's claim. The SDK's claim states (what games receive) are unchanged.
- **Display:** "Sent, delayed" / "Confirmed, delayed" with "it has not failed" in the staff step log, milestone table and details, and in the player's claim
  list, details and the milestone line; only waiting states can show it.
- **Lamp:** new feature `features/chain-status` (route `GET /api/v1/chain/indexing`, `<IndexingBadge>`), the shared `StatusLamp` in a compact form with a
  neutral tone and a hover/focus detail, and a `ShellStatusProvider` header slot so the layout places it without any feature knowing of the shell.
  `none` draws nothing; `unavailable` is grey "Chain status unknown"; delayed is amber.
- **Also fixed on this branch (left by the regtest task):** two lint errors in `packages/chain/regtest` (an unused helper; environment reads, now the
  stack's typed defaults through `@repo/regtest/config`), and the vitest adoption policy now lists the regtest config as a documented exception.

## Decisions taken on defaults (review at merge)

- 1-2 blocks behind is green with the count; only more than 2 is amber. An unreadable chain is grey, never red or green.
- The lamp refreshes every 30 s, not while the tab is hidden; the platform asks the node at most once per 15 s.
- Rows sent before `broadcast_at` existed use their last change time.
- Games are not told a claim is delayed (no protocol change).

## Evidence (commands that ran)

- `pnpm typecheck` (53/53 earlier; web re-checked after the last fixes), `pnpm exec turbo run lint` (53/53), `pnpm repository:check` (53 workspaces, 1877
  files), `pnpm env:check` (33/33), `pnpm exec turbo run test:unit` (53/53), `pnpm exec turbo run test:integration` (53/53, with Postgres),
  `pnpm exec turbo run test:coverage` for the eleven touched workspaces (all above thresholds; new modules 100% statements, branches at or near 100%),
  `pnpm --filter e2e test:e2e` (405 passed, 152 skipped as before).
- Mutation checks: 24 changes to the rule, the cache, the judge, the route, the lamp, the badge and the copy, and 4 to the repositories and views; every
  one made a test fail.

## Not done

- Not seen against a live signet indexer (it is stalled, S73); the e2e suite runs with no rewards chain, so the lamp draws nothing there.
- No Playwright test for the lamp with a followed chain (the e2e stack has no chain to follow).
- `ChainConfig.confirmations` is still not read by any service.
