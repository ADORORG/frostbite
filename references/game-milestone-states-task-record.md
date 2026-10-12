# G4 Milestone states in the host

Branch `feat/game-milestone-states`, stacked on `docs/game-onboarding-guide` (`cd08c84`).

## What was built

- `features/games/src/domain/milestone-state.ts`: the one place that says where a milestone stands. Only
  `not-earned` and `earned` are true today. An earned milestone reads "Reached" with "Reported by the game on
  <day>. It cannot be minted yet." Never "verified", never "minted". The claim states (pending, claimed,
  complete) are added here when minting exists, and every page gains them at once.
- `features/games/src/ui/milestone-list.tsx`: "N of M reached" in a polite live region plus each milestone with
  `data-state`; used by the player panel (the game detail's declaration list stays declarations).
- Tests: domain unit tests, player integration (state, live region, reload), e2e summary text; game-host
  snapshots regenerated (the panel is the only visual change).

## Evidence

format, lint (42 + repository policy), typecheck (42), feature-games 51 tests, coverage 97.32/96.2/95.91/98.07,
e2e game-host + account-sync + games-quality: 37 passed, 3 skipped by design (full suite not re-run: only the game
page changed). Mutants: 6 on the new code, all killed (one, the live region, survived until a test was added).
The player test file passed 300 lines and was split (shared harness in `test/support/player-harness.tsx`).

## Not done

The claim states and any action on a milestone (G7). The formal three-pass convergence review was not run.
