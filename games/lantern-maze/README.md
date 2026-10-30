# Lantern Maze

A fog-of-war maze for the platform: thirty floors of a dark cellar, one lantern, and oil that every step burns. On each floor the player
finds the key (it lies at the end of a blind alley) and then the locked door, seeing only the cells the lantern lights. Flasks of oil lie
off the way. Coming down to a floor brings the oil for it, but a thinner share each floor, and the light shortens as the floors go. The run
ends when the oil is gone, the last floor is cleared, or the record is full. It is client-only: no server, no network, nothing stored by
the game itself (the platform keeps progress and milestones).

## Public API

Nothing: a game is a page. `src/main.ts` joins the pieces to the page and the platform; everything else is a module of its own.

| Module                               | Purpose                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/rules/`                         | The rules, as a pure seeded state machine (`mazeRules`, a `GameVerifier`): maze, floor, light, steps, scoring, the forty milestones. |
| `src/session.ts`                     | One run as the player plays it: applies steps through the rules and records each accepted one into a run record.                     |
| `src/screen/`                        | Draws a state on a canvas (the lit cellar, the lantern, the writing and the cards). Draws and decides nothing.                       |
| `src/audio.ts`, `src/feedback.ts`    | The music and effects as data, and which effect each change of state makes. The music speeds up as the oil runs low.                 |
| `src/progress.ts`                    | What is saved (the best score and the sound settings) and how what the platform hands back is validated.                             |
| `src/replay.ts`, `src/sample-run.ts` | What the platform replays: the rules and one legal run. Its digest is pinned in `configs/games/lantern-maze.ts`.                     |

## How it plays

- **Keys:** the arrows or WASD step the lantern, or swipe the screen (a pad appears on a touch screen). Enter starts a run and never throws
  one away; P or Space pauses.
- **A floor:** a maze carved from the run's seed and the floor number, 7 by 5 cells on the first floor and 15 by 9 from the tenth. From the
  fifth floor some walls are taken out, so there are loops. The lantern lights cells within 4 steps along the passages, then 3, 2 and 1.
- **Oil:** the run starts with two and a half times the first floor's shortest route. Every step burns one. A flask is worth 8% of the floor's
  shortest route. Clearing a floor brings the lantern to the next with that floor's shortest route times a share that falls from 112% to 100%
  by the thirteenth floor, so a player who goes the shortest way always has enough, and one who wanders does not.
- **Score:** 100 times the floor for each floor cleared, 4 for each step under twice its shortest route, and 25 for a flask.

## Milestones

Forty, all decided by the state of a run alone (`src/rules/milestones.ts`): the first step, and ladders of floors cleared (1 to 30), flasks
taken, floors cleared lean (in at most 130% of the shortest route), floors cleared by exactly the shortest route, floors cleared with every
flask taken, lean floors in a row, the most oil held, steps and score. The words are in the manifest; a test fails if the manifest and the
rules name different ones. **The list is a draft for the owner to approve.** The numbers come from two measured players
(`test/support/bots.ts`): one who sees the whole cellar always escapes all thirty floors in about 3,300 steps (4,400 if it detours for every
flask), and one who sees only what the lantern lit and remembers it perfectly usually runs out of oil between the eighth and the twentieth
floor. Together they earn every milestone. Nobody has played the game, so what a person finds hard is not known.

## Invariants

- The same seed and steps play out the same way on every engine (no clock, no `Math.random`, whole numbers).
- A run records at most 4,900 steps (and one closing input), inside the platform's ceiling of 5,000 inputs. A perfect run needs about 3,300.
- A floor can always be cleared: the maze is carved so every cell is reachable, and the entry oil covers the shortest route.
- The screen never moves the page: everything that changes is drawn on the canvas or written into a box of fixed size.

## Tests

`pnpm --filter @game/lantern-maze test:unit`, `test:integration` (the bundled page against a simulated platform, and the whole-game
fairness tests), `test:coverage` (above 90%), `typecheck`, `lint`.

## Ownership

Games team.
