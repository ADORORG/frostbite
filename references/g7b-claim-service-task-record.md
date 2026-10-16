# G7b: claiming a milestone on the simulated chain (#70)

Branch `feat/g7b-claim-service`, stacked on `feat/g7a-manifest-rewards`; baseline `e1e5c6b`. Plan: `docs/product/plan-g7-minting.md`.
Package README: `packages/game-claims/README.md`. Findings: S55.

## What was built

- **`@ador/shared/chain`:** the `mint-milestone` operation, intent (`contract`, `milestoneId`) and summary field (`milestone`), so a
  person sees the milestone and its contract before signing; `milestoneIdSchema`. A chain configuration now needs a confirmation
  policy for the operation (the type check enforces it; D22 will decide the values).
- **`@ador/chain`:** the `rewards` port (`RewardsReader.claimed(contract, holder, milestoneId)`, capability `rewards:read`).
- **`@ador/test-kit`:** the simulated chain takes claims into effect (past the finality depth, not reverted), can revert a
  transaction, and implements the reader; a conformance check for the reader and for the claim summary's fidelity; the adapter is
  held to the suite once with a transfer and once with a claim.
- **`@ador/database`:** `ador.game_milestone_claims` (migration `20261016074317_game_milestone_claims`): neutral states plus
  `expired`, checks that tie the fields to the state, and a partial unique index allowing one claim in progress per player,
  game and milestone.
- **`@ador/game-claims` (new):** `start`, `submitSigned`, `refresh`, `list`; the Drizzle repository (advisory lock on create, row
  lock on update); pure transition rules; a summary codec for bigint amounts.

## Verification (run on this branch)

- **Tests:** the whole lifecycle on the simulated chain against real PostgreSQL, each refusal and failure, concurrency (60 starts
  at once make one claim; two looks at one claim cannot overwrite each other), ownership, the table's constraints, the codec and
  the transition rules. `@ador/game-claims` 68 tests.
- **Mutation proof:** 29 breaks of the service, repository, transitions and codec; the first run left 2 alive (a state guard that
  a table check also backs up, and the advisory lock under too little contention); a stronger overlap test and 60-way concurrency
  killed both.
- **Coverage (statements / branches / functions / lines):** `@ador/game-claims` 99.5/94.7/100/100; `pnpm test:coverage` passed for
  all 48 workspaces.
- `pnpm format:check`, `pnpm lint` (48 workspaces, repository policy), `pnpm typecheck`: passed. The e2e suite was not run: no
  page, route or shipped game changed.

## Found along the way

- The simulated network did not read a signed payload (it ends in the wallet's marker), so a claim could never take effect on it;
  its reader now decodes through the marker.
- `service.ts` went to 337 lines; types and the small step helpers moved to `types.ts` and `claim-steps.ts`.
- A migration's `snapshot.json` is not left formatted by `drizzle-kit`; it is formatted with the rest.

## Not done

HTTP routes, SDK method and host handler (G7c), the page (G7d), the contract and the real adapter (G7e).
