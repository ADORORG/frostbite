# A finished game: where each part lives

These paths are in the platform's repository. Open the file when you need the real thing. `games/bro-maria` is a platformer; it has
every part a game can have.

| Part                                               | File                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Rules as a pure state machine                      | `games/bro-maria/src/rules/index.ts` (the `GameVerifier`), `tick.ts`, `hero.ts`, `collide.ts` |
| Level generated from the seed                      | `src/rules/level.ts`                                                                          |
| Milestones decided by the rules                    | `src/rules/milestones.ts`                                                                     |
| One run as the player plays it                     | `src/session.ts`                                                                              |
| Screen drawn from a state                          | `src/screen/draw.ts`, `sprites.ts`, `backdrop.ts`, `palette.ts`                               |
| Touch and keyboard controls                        | `src/screen/controls.ts`                                                                      |
| Music and effects as data                          | `src/audio.ts`, `src/feedback.ts`                                                             |
| What is saved and how it is validated              | `src/progress.ts`                                                                             |
| The page: joins everything to the platform         | `src/main.ts`, `index.html`, `styles.css`                                                     |
| The verifier the platform replays                  | `src/replay.ts`, `src/sample-run.ts`                                                          |
| The manifest and its pinned digest                 | `configs/games/bro-maria.ts`, registered in `configs/games.ts`                                |
| A bot that plays the game in tests                 | `test/support/bot.ts`                                                                         |
| Page tests (Enter, pause, sound, platform failure) | `test/page.integration.test.ts`, `test/support/page.ts`                                       |

Three smaller games show the same pattern on a one-button input: `games/frost-runner`, `games/icicle-drop`, `games/tower-stack`.
For a game with several replayable cabinets under one verifier, read `games/frostbite` (SAT SNAKE and the ice field).
