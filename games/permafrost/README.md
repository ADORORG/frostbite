# Permafrost

Started from the template (`tooling/game-tools/template`), which is a small finished game. Replace the rules, the drawing, the words
and the milestones in `configs/games/permafrost.ts`; see `docs/product/game-onboarding.md`.

## Layout

- `src/rules/`: the rules, a pure seeded state machine (the same seed and inputs always give the same run), and the milestones.
- `src/session.ts`: one run as the player plays it, and the run record its taps make.
- `src/screen/`: drawing, controls and the card after a run. `src/guide.ts` is the first-screen card.
- `src/audio.ts`, `src/feedback.ts`: sound as data, and what the player hears for what happened.
- `src/replay.ts`, `src/sample-run.ts`: the verifier the platform replays; the manifest pins its digest (a test prints the digest to pin when the rules change).
- `src/main.ts`: joins the above to the page and the platform.

## Test commands

`pnpm --filter @game/permafrost test:unit`, `test:integration`, `test:coverage`.

## Ownership

The game's author owns it; the platform games team reviews every game before it is merged.
