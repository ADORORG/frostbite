# A finished game: where each part lives

These paths are in the platform's repository. Open the file when you need the real thing. Pick the closest game and copy its shape.

| You are building                                   | Closest game                                                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One-button or tap game, real time, a seeded course | `games/frost-runner`, `games/icicle-drop`, `games/tower-stack`, `games/snowball-dash` (first drafted by an agent from this skill, then rebuilt after playing it) |
| Several keys, a scrolling level, touch zones       | `games/bro-maria`                                                                                                                                                |
| Several replayable cabinets under one verifier     | `games/frostbite` (SAT SNAKE and the ice field)                                                                                                                  |

## The parts, in `games/frost-runner`

| Part                                               | File                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Rules as a pure state machine (the `GameVerifier`) | `src/rules/index.ts`, with `constants.ts`, `types.ts` and the tick function beside it |
| One run as the player plays it                     | `src/session.ts`                                                                      |
| Screen drawn from a state                          | `src/screen/`                                                                         |
| Keys, and touch (the screen as the controller)     | `src/screen/controls.ts` (`thumbs.ts` in Bro Maria)                                   |
| Music and effects as data                          | `src/audio.ts`, `src/feedback.ts`                                                     |
| What is saved and how it is validated              | `src/progress.ts`                                                                     |
| The page: joins everything to the platform         | `src/main.ts`, `index.html`, `styles.css`                                             |
| The verifier the platform replays                  | `src/replay.ts`, `src/sample-run.ts`                                                  |
| The manifest and its pinned digest                 | `configs/games/frost-runner.ts`, listed in `configs/games.ts`                         |
| A bot that plays the game in tests                 | `test/support/bot.ts`                                                                 |
| Proof the hardest milestones can be met            | `test/fairness.unit.test.ts`                                                          |
| Page tests (keys, pause, sound, platform failure)  | `test/page.integration.test.ts`, `test/support/page.ts`                               |
| Project config                                     | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`              |

`games/bro-maria` has the same parts for a platformer: rules in `src/rules/` (`level.ts` generates the level from the seed), a screen
in `src/screen/`, touch zones in `src/screen/thumbs.ts`, built on `attachZones`. `games/lantern-maze` steers toward a finger and `games/aurora-pulse`
takes a tap in a lane, with the same primitive.
