# Aurora Pulse

A rhythm game for the platform. Notes fall down four lanes toward a line; the player taps each lane as its note meets the line (D F J K, the arrow
keys, or a tap on the lane itself; the margins either side belong to the lane beside them). A tap is judged perfect (within 2 ticks, about a thirtieth of a second), great (5) or good (9) by how far off the
note it was, or is a stray if no note of its lane is in reach; a note not tapped is a miss. Hits fill the light of the aurora and build a combo that
multiplies the score; misses and strays drain the light, and the run ends when it is gone, or the track (about ten minutes, 36 stages' worth of
chart) is played out. It is client-only: no server, no network, nothing stored by the game itself (the platform keeps progress and milestones).

## Public API

Nothing: a game is a page. `src/main.ts` joins the pieces to the page and the platform; everything else is a module of its own.

| Module                               | Purpose                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/rules/`                         | The rules, as a pure seeded state machine (`pulseRules`, a `GameVerifier`): the chart, the judging of taps, energy, combo, score, the forty milestones. |
| `src/session.ts`                     | One run as the player plays it: ticks the rules, records each tap (with its tick) into a run record, and closes it with the tick it reached.            |
| `src/screen/`                        | Draws a state on a canvas (the aurora, the lanes and notes, the writing and the cards). Draws and decides nothing.                                      |
| `src/audio.ts`, `src/feedback.ts`    | The music and effects as data, and which effect each change of state makes. Each lane taps in a note of its own; a perfect tap adds a glint.            |
| `src/replay.ts`, `src/sample-run.ts` | What the platform replays: the rules and one legal run. Its digest is pinned in `configs/games/aurora-pulse.ts`.                                        |

## How it plays

- **Time:** sixty ticks a second, a beat is 32 ticks (112.5 a minute), a bar four beats, and a note sits on one of sixteen slots in a bar. The rules
  count ticks; the screen's music does not decide anything, so a late or stuttering speaker cannot change a score.
- **The chart:** made from the seed, bar by bar, as the run goes on, and eight bars make a stage. Stage one is a note a beat; half beats come in at
  stage three, quarter beats at six, chords at five, and a lane may be asked for twice in a row closer from stage eight. The notes a second go up from
  about 1.4 to about 7 by stage fifteen and then hold.
- **Judging:** a tap hits the nearest note of its lane within 9 ticks. Perfect gives +2 light, great +1, good none; a miss costs 6 and a stray tap 3.
  The light starts at 60 and holds at most 100.
- **Score:** 300, 200 or 100 for perfect, great or good, times a multiplier of one more for each ten of the combo, up to eight.
- **Pause:** P or Space. A paused run adds no tap and no tick.

## Milestones

Forty, all decided by the state of a run alone (`src/rules/milestones.ts`): the first hit, and ladders of score (5,000 to 1,500,000), combo (10 to 800),
perfects (25 to 800), stage reached (2 to 20), hits, bars played clean, and perfects in a row (5 to 100), and two marks: the light filled to the top,
and the whole track played out. The words are in the manifest; a test fails if the manifest and the rules name different ones. **The list is a draft for
the owner to approve.** The numbers come from five measured players (`test/support/bots.ts`), each tapping a few ticks off the note by an amount that
grows with the stage: one exactly on time plays the whole track (about 3,000 taps, well inside the 4,900 a record holds); a strong one fades at stage 30
to 34, a good one at 16 or 17, an average one at 10 to 12, a poor one at 4 to 7. Together they earn every milestone. Nobody has played the game, so how
those numbers compare with a person's timing is not known; the late stages and the last rungs are for very good players.

## Invariants

- The same seed and taps play out the same way on every engine (no clock, no `Math.random`, whole numbers).
- A record holds at most 4,900 taps (strays count) and one closing input, inside the platform's ceiling of 5,000.
- A record is closed with the tick the run had reached, so a run that faded after its last tap replays to the same end.
- A lane pressed with no run going does nothing; only Enter and the button start a run.
- The screen never moves the page: everything that changes is drawn on the canvas or written into a box of fixed size.

## Tests

`pnpm --filter @game/aurora-pulse test:unit`, `test:integration` (the bundled page against a simulated platform, and the whole-game fairness tests),
`test:coverage` (above 90%), `typecheck`, `lint`.

## Ownership

Games team.
