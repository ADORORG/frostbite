# Shard Match

A match-and-chain puzzle for the platform: an eight by eight board of shards in five kinds (six from level four), each kind a colour and a shape.
The player swaps two neighbouring shards to line up three or more of a kind. Lines clear, what is left falls, new shards come in, and a line made
by the fall is a chain that scores more at every step. Four in a line leaves a bomb (it clears the nine cells round it when it goes off), five or
more a star (its row and its column); a star, and each step of a chain past the second, buys another swap. The run ends when no swap is left to
make. It is client-only: no server, no network, nothing stored by the game itself (the platform keeps progress and milestones).

## Public API

Nothing: a game is a page. `src/main.ts` joins the pieces to the page and the platform; everything else is a module of its own.

| Module                               | Purpose                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/rules/`                         | The rules, as a pure seeded state machine (`matchRules`, a `GameVerifier`): board, lines, specials, chains, swaps, levels, the forty milestones. |
| `src/session.ts`                     | One run as the player plays it: applies swaps through the rules and records each accepted one into a run record.                                 |
| `src/screen/`                        | Draws a state on a canvas (the board, shapes, flash, cursor, the writing and the cards). Draws and decides nothing.                              |
| `src/audio.ts`, `src/feedback.ts`    | The music and effects as data, and which effect each change of state makes. A match rings higher the longer its chain; the music speeds up late. |
| `src/progress.ts`                    | What is saved (the best score and the sound settings) and how what the platform hands back is validated.                                         |
| `src/replay.ts`, `src/sample-run.ts` | What the platform replays: the rules and one legal run. Its digest is pinned in `configs/games/shard-match.ts`.                                  |

## How it plays

- **Keys:** the arrows or WASD move a cursor; Space picks up the shard under it and an arrow then swaps it that way. A tap picks a shard up and a
  tap on a neighbour swaps them; so does a drag from a shard to its neighbour. Enter starts a run and never throws one away; P pauses (Space is
  the main action here, so it does not). After six seconds without a move the screen points at a swap that makes a line.
- **A swap must make a line.** One that does not is refused, costs nothing and is not recorded. A board with no swap left is shuffled.
- **Levels.** A run is a series of levels, each on a fresh board with a number of swaps (22, fewer as the levels go, to 13). Odd levels ask for a
  score (500 plus 450 a level); even levels freeze some cells (8 plus 3 a level, to 36) and the goal is to break all the frost, which a match that
  clears a frosted cell does. A level not cleared when its swaps are gone ends the run. Clearing one pays the swaps left over (50 points a swap
  times the level) and carries up to three of them into the next.
- **Bombs and stars.** Four in a line makes a bomb (clears the nine cells round it), five or more a star (its row and column). A star, and each
  step of a chain past the second, buys another swap.
- **Score:** ten a shard times the step of the chain it is cleared in, and fifty times the step for each shard in a line past the third.
- **What you see.** The swap slides, cleared shards flash and burst into confetti (ice for frost), what is left falls and new shards drop in, step
  by step; the music rises a note with each step of a chain, the screen shakes for a bomb, a star or a third step, and words (SWEET! TASTY!
  DELICIOUS! DIVINE!, BOMB!, STAR!) rise over the board. A new swap made while one is still playing ends that playback at once. None of it is read by
  the rules: the rules play a swap in one go, and the screen plays the same steps (`src/screen/trace.ts`) back.

## The tall screen

On a phone held upright (`(max-width: 46rem) and (orientation: portrait)`, the same query the SDK's phone stylesheet uses) the screen is 90x108 instead of 160x90: the board is in the same place and the writing is in rows under it (`screen/hud.ts` `strip`), with shorter lines on the cards that say Start, not Enter (`screen/cards.ts`). `screen/shape.ts` watches the query and fits the canvas; touches are read by the size of the shape shown.

## Milestones

Forty, all decided by the state of a run alone (`src/rules/milestones.ts`): the first swap, and ladders of score (1,000 to 300,000), levels
cleared (1 to 16), the longest chain (2 to 7 steps), the longest line (4 to 6), bombs and stars made, bombs set off, shards cleared, frost broken
(25 to 300) and the most one swap scored. The words are in the manifest; a test fails if the manifest and the rules name different ones. **The list is
a draft for the owner to approve.** The numbers come from three measured players (`test/support/bots.ts`): one who makes any swap that makes a line
clears one or two levels and runs out on the first frost level; one who always makes the swap that scores most (and breaks frost) clears about 3 to
14; one who looks a swap further went on far past that. Together they earn every milestone. Nobody has played the game, so what a person finds hard
is not known.

## Invariants

- The same seed and swaps play out the same way on every engine (no clock, no `Math.random`, whole numbers).
- A run records at most 4,900 swaps (and one closing input), inside the platform's ceiling of 5,000 inputs.
- A board never has a line standing between swaps, and always has a swap to make (a board without one is shuffled).
- The screen never moves the page: everything that changes is drawn on the canvas or written into a box of fixed size.

## Tests

`pnpm --filter @game/shard-match test:unit`, `test:integration` (the bundled page against a simulated platform, and the whole-game fairness tests,
about a minute: the planner plays 600 swaps, and the last milestone comes by its 500th), `test:coverage` (above 90%; it leaves the fairness file out, which adds nothing to coverage and runs three times slower instrumented), `test:simulation` (the fairness file alone, plain), `typecheck`, `lint`.
`SHARD_MATCH_LONG=1 pnpm --filter @game/shard-match test:integration` also plays the planner's whole 1,200 swaps (about two more minutes).

## Ownership

Games team.
