# Snowball Dash

An endless one-button runner for the platform. A snowball rolls down a slope that never ends and gets faster as it goes; the player hops
it over rocks, boulders, rows of ice spikes and crevasses. A tap is a short hop and holding the button is a high one, so every obstacle
asks for a different length of press. Shards are worth taking, and cutting an obstacle fine (a close call) builds a score multiplier, so
the safe line and the high-scoring line are not the same line. A run ends when the snowball hits something or falls in.

## Public API

Nothing: a game is a page. `src/main.ts` joins the pieces to the page and the platform; everything else is a module of its own.

| Module                               | Purpose                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/rules/`                         | The rules, as a pure seeded state machine (`snowballRules`, a `GameVerifier`): physics, the course and its patterns, scoring, the forty milestones. 60 ticks a second, whole numbers only. |
| `src/session.ts`                     | One run as the player plays it: ticks the rules, records each press and release into a run record.                                                                                         |
| `src/screen/`                        | Draws a state on a canvas (sky, hills, snow, obstacles, shards, the snowball, the writing). Draws and decides nothing.                                                                     |
| `src/audio.ts`, `src/feedback.ts`    | The music and effects as data, and which effect each change of state makes. The music speeds up with the level.                                                                            |
| `src/progress.ts`                    | What is saved (the best score and the sound settings) and how what the platform hands back is validated.                                                                                   |
| `src/replay.ts`, `src/sample-run.ts` | What the platform replays: the rules and one legal run. Its digest is pinned in `configs/games/snowball-dash.ts`.                                                                          |

## How it plays

- **Keys:** Space, the up arrow, Enter or a touch on the screen are all the one button. With no run going it starts one (that press is not a
  hop). P pauses. Release the button early and the climb is cut short.
- **The slope:** one level every 75 metres; each level is one tick-unit faster, up to a top speed at level 9. Patterns get harder with the
  level (rock, boulder, crevasse, twin rocks, spikes, then combinations up to a four-part gauntlet). Every pattern leaves room to land and hop
  again; the lookahead player in `test/support/planner.ts` proves it (below).
- **Score:** a point a metre, ten for a clear, twenty-five times the multiplier for a close call, ten times the multiplier for a shard. The
  multiplier is one more than the streak of close calls, up to ten; a plain clear ends the streak.

## Milestones

Forty, all decided by the state of a run alone (`src/rules/milestones.ts`): the first hop, and ladders of score (500 to 100,000), distance (100 m
to 2,000 m), hop height, hop length, shards, obstacles cleared (all, then boulders, crevasses and spikes), close calls in a row and close calls
in all. The early rungs come in the first minutes and the top ones take many runs. The words are in the manifest; a test fails if the manifest
and the rules name different ones. **The list is a draft for the owner to approve.** Nobody has played the game to calibrate the thresholds:
they come from the player in `test/support/planner.ts`, which earns all forty on every seed over a full 6 minute 40 second run, so the top
rung is the full length of a perfect run.

## Invariants

- The same seed and choices play out the same way on every engine (no clock, no `Math.random`, whole numbers).
- Everything that changes while a run is played is drawn on the canvas or written into a box of fixed size; the page is touched only when
  something has changed, never once a frame, and no list is rebuilt. The layout (the screen, the sound panel, the note, the buttons and the
  earned list) never moves, which was measured in a real browser at desktop, phone and phone-on-its-side sizes.
- A run records at most `maxChoices` (1,100) choices, so its record is always inside the platform's size limit.

## Tests

`pnpm --filter @game/snowball-dash test:unit`, `test:integration` (the bundled page against a simulated platform, and the slow fairness
tests that play whole runs through the rules), `test:coverage` (above 90%), `typecheck`, `lint`. The layout over a whole run in a browser:
`tests/e2e/tests/snowball-dash-layout.spec.ts`.

## Ownership

Games team.
