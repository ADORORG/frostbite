# G7d: the player's side of a claim (#72)

Branch `feat/g7d-claim-ui`, stacked on `feat/g7c-claim-protocol`; baseline `1ae4595`. Plan: `docs/product/plan-g7-minting.md`.
Findings: S57.

## What was built

- `features/games`: `domain/claim-copy.ts` (every state and reason said in one place), `client/claims-api.ts` (the four routes;
  the port now uses it), `ui/use-claims.ts` (list, start, sign, follow, tell the game), `ui/use-player-claims.ts` (the pieces the
  game's session needs), `ui/claim-review.tsx`, `ui/claims-card.tsx`, a Claim button in the milestone list, the Claims dock
  section, `claimable` on the catalog's public game, the wallet wrapper reading the connection for a game that cannot see it.
- `@repo/ui`: `.arcade-claim` styles on the arcade tokens.
- The SDK explorer's page now carries the Claims section, and an e2e covers claiming from the dock.

## Verification (run on this branch)

- Unit and integration tests of the copy, the API client, the port, and the player (a start, the review, signing, following to
  complete, every refusal, a game's own request, the dock section, polling that stops when a claim is over, a list or look that
  fails).
- **Mutation proof:** 21 breaks across the hook, the review, the milestone list, the copy, the wallet wiring and the catalog; the
  first run left 8 alive (an announcement on load that the game could not hear before it was ready, an unreachable guard that was
  replaced by a silent return, the newest-claim choice, a Sign button on a claim already sent, the "Confirmed" word, the expired
  state, and two flags that decide whether a game is offered claims at all); tests were added and all were caught on the re-run.
- **Coverage (statements / branches / functions / lines):** `@frostbite/feature-games` 95.4/94.6/92.5/95.5. `pnpm test:coverage`,
  `pnpm format:check`, `pnpm lint` (48 workspaces, repository policy) and `pnpm typecheck` passed.
- **Full end-to-end run:** 388 passed, 137 skipped (project-specific), 0 failed, on a fresh production build. The first run had one
  failure, the explorer's claim answer: with no wallet connected the page says so (`no-wallet`) before the platform is asked.

## Found along the way

- A test found that the claims service read the wallet from the game-visible wallet prop, so a game that did not declare `wallet` could
  never claim; the page now reads its own connection for claiming.
- `game-player.tsx` went past 300 lines; the claims wiring moved to `use-player-claims.ts` and the dock section to `claims-card.tsx`.

## Not done

The real signer and the contract and chain (G7e).
