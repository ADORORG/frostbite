# Permafrost

Falling blocks on a ten by twenty board. Seven pieces come from a seeded bag, the player slides and turns each, holds one back for later, and
drops it where the ghost shows. Rows clear, the level rises every ten rows and the ice speeds up, and from level twelve grey rows rise from
below. The run ends when the stack reaches the top. Thirty-two milestones, each checked by replaying the run; the leaderboard ranks the score the
same replay reports.

## Controls

Keyboard: arrows move (hold for repeat) and soft drop, Up or X turns right, Z turns left, Space drops at once, C or Shift holds, Enter starts,
P pauses. Space only drops while a run goes, so a player still dropping as the run ends keeps the card that says how they did.

Touch: a thumb on the left third slides left, on the right third slides right, a tap in the middle turns. Four buttons in the corner: Drop,
Soft (held), Hold and Turn back.

## Layout

- `src/rules/`: the rules, a pure seeded state machine at sixty ticks a second. `difficulty.ts` holds the whole difficulty curve (gravity, lock
  delay, pieces shown ahead, when grey rows rise) so it can be read and tested in one place; `milestones.ts` the thirty-two milestones;
  `keys.ts` how a run's keys are written down (`12l3a` is left on tick 12, turn on tick 15).
- `src/session.ts`, `src/hands.ts`: one run as the player plays it, and the key repeat of a held arrow. A held arrow is recorded as the presses
  it repeats into, so a replay needs no idea of "held". Only keys that did something are recorded.
- `src/screen/`: drawing (`draw.ts`, `panels.ts`, `cells.ts`), keys and touch (`controls.ts`, `touch.ts`) and the card after a run. Each piece has
  a mark of its own inside its cells, so colour is not the only way to tell them apart.
- `src/audio.ts`, `src/feedback.ts`, `src/guide.ts`: sound as data, what the player hears for what happened, and the first-screen card.
- `src/replay.ts`, `src/sample-run.ts`: the verifier the platform replays; the manifest pins its digest (a test prints the digest to pin when the
  rules change, and `verifierVersion` rises with it).
- `art/`, `milestone-art/`: a generator for the thirty-two milestone drawings and its output, one file named for each milestone, ready for the
  staff page's "Define many milestones". The frame's colour and dots say how hard the milestone is. `pnpm --filter @game/permafrost art` writes
  them; `apps/web/test/games-milestone-art.unit.test.ts` holds them to the platform's drawing limits.
- `assets/cover.svg`: the cover.

## How hard it is, and the evidence

`test/fairness.unit.test.ts` plays the game with bots of known skill, on fixed seeds, so the figures are facts about the rules: a player who
does nothing earns nothing and is frozen out in about 75 seconds, one who presses keys at random earns only `first-hold`, a beginner gets seven
milestones, a steady player nineteen, a quick one lines-150, and only the best (one that looks a piece ahead) reaches 200 rows and level 20.
Seven milestones need technique no bot has: fours, back-to-back, long combos and a clear board (the rules tests prove each can be earned).
If a change to the rules moves these figures, a milestone has become easier, harder or out of reach, and the test says which.

## Test commands

`pnpm --filter @game/permafrost test:unit`, `test:integration`, `test:coverage`; from `apps/web`,
`npx vitest run --project unit test/games`.

## Ownership

The game's author owns it; the platform games team reviews every game before it is merged.
