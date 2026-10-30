# Snowball Dash

A one-button game for the platform's arcade. A snowball rolls down a 600 metre slope and speeds up as it goes; press Enter or Space
(or tap the screen) to hop it over the rocks. A run ends when the snowball hits a rock or reaches the foot of the slope. It is
client-only: no server, no network, nothing stored by the game itself (the platform keeps progress and milestones).

## Layout

```
src/rules/     the rules, as a pure seeded state machine (a GameVerifier): constants, course, tick, milestones, index
src/session.ts one run as a player plays it: ticks, hops, and the run record they make
src/screen/    drawing the state, and the keys and touches
src/audio.ts   the music and effects, as data; src/feedback.ts says which effect a change of state deserves
src/progress.ts what is saved (the best distance and the sound settings) and how it is validated
src/main.ts    joins the page to the platform (progress, milestones, runs)
src/replay.ts  the verifier the platform replays runs with (rules + one sample run)
```

## Keys, sound and pause

Enter, Space, the up arrow or a touch hops. Enter starts a run when none is going and hops during one, so it never throws a run
away. P (or the Pause button) pauses and resumes, and a hidden tab pauses; Space is the main action and so never pauses. The music
is a looping groove and each hop, landing, crash and milestone has an effect, played by the SDK's sound engine with the panel at the
bottom left. The sound settings are kept beside the best distance. The page runs on the SDK's run loop, so pausing stops the clock.
None of the sound or the screen is in the rules, so it does not change the verifier's digest.

## How runs are checked

The rules know only ticks (thirty a second) and whole numbers; the same seed and hops always play out the same way. The platform
gives a run its seed, the game records only the hops with the tick each was made on, and on `run.submit` the platform replays the
record with the published verifier. A milestone the replay earns is held as replay-verified, which shows the run followed the
rules, not that a person played it. The verifier's SHA-256 is pinned in `configs/games/snowball-dash.ts`; changing the rules
changes the digest, and `apps/web/test/games-verifiers.unit.test.ts` fails (printing the new digest) until the pin is updated
together with `verifierVersion` and the game's `version`. Nothing here carries a reward: the manifest declares no `rewards`.

## Milestones

Ten, all decided by the state of a run alone (`src/rules/milestones.ts`): first hop, 5 and 15 rocks passed, 100 m and 300 m rolled,
one and five close shaves (a rock cleared by at most 2 units), top speed, the foot of the slope, and a tidy run (the foot reached
with no more hops than rocks). The words are in the manifest. `test/fairness.unit.test.ts` shows a careful bot reaches the foot on
every tested seed and that a late-hopping bot earns all ten.

## Tests

`pnpm --filter @game/snowball-dash test:unit`, `test:integration` (bundles the page and runs it against a simulated platform),
`test:coverage`. `test/support/bot.ts` is a player that hops when the next rock is within a chosen distance.

## Ownership

Platform games team.
