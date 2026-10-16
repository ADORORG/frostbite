# G7c: asking for a claim from a game, and the routes behind it (#71)

Branch `feat/g7c-claim-protocol`, stacked on `feat/g7b-claim-service`; baseline `59b1881`. Plan: `docs/product/plan-g7-minting.md`.
Findings: S56.

## What was built

- **`@ador/game-sdk`:** the `milestones.claim` method and `claim.changed` event (capability `milestone:claim`), the claim states
  and reasons, `claimCallsPerMinute` policy, `ClaimsService` on the host's services, `client.milestones.claim`.
- **`@ador/shared/games`:** `claims.ts`, the wire contracts and four routes (start, submit, refresh, list), plain text throughout.
- **`@ador/game-claims`:** `start` takes the wallet as text and parses it for the game's chain; `playerClaimState` names a
  lifecycle state for the player.
- **`@ador/game-saves`:** `hasEarnedMilestone`.
- **`@ador/feature-games`:** the four operations, the runtime (`claimableGameLookup` from the manifest and the configuration), the
  page's claims port, the player's `claimsFor`; `configs/game-claims.ts` (nothing configured).
- **Tests:** host, client and protocol; the wire contracts; the operations; the page port and the game page; the lookup; the earned
  query against real PostgreSQL; and `apps/web/test/game-claims-flow.integration.test.ts` driving the operations end to end
  against real PostgreSQL and the simulated chain.

## Verification (run on this branch)

- **Mutation proof:** 21 breaks across the host, protocol, operations, port, lookup and the earned query; the first run left 1
  alive (the claim limits passed to the service); a unit test of the lookup killed it.
- **Coverage (statements / branches / functions / lines):** `@ador/game-sdk` 98.3/96.9/98.6/98.4; `@ador/game-claims` 98.9/94.0/100/99.4; `@ador/feature-games` 94.8/95.1/91.0/94.5; `@ador/shared` 99.0/99.1/98.0/98.9; `@game/sdk-explorer` 100/91.7/100/100. `pnpm test:coverage` passed for all 48 workspaces.
- `pnpm format:check`, `pnpm lint` (48 workspaces, repository policy), `pnpm typecheck`: passed.

## Not done

The page that shows the claim and asks the wallet to sign, and the event pushes (G7d); the contract and real adapter (G7e).

## Found along the way

- The first full run failed in two places that were consequences: a test file went to 333 lines and was split (the repository
  policy), and the SDK explorer, whose test holds it to calling every method the SDK has, needed a `milestones.claim` probe, so
  it now declares `milestone:claim` and a rewards contract and shows the call answered `not-supported`.
- The catalog now lists `milestone:claim` as granted (the host answers it), where G7a had it declared but not granted; every
  claim is still answered "not supported" until a contract and a chain are configured.
- The OpenAPI generator refused a branded chain type in a route's schema; the wire schemas use the text forms.

## Full end-to-end run

387 passed, 134 skipped (project-specific), 0 failed, on a fresh production build.
