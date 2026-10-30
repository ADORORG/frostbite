# Frost Runner

An endless runner over the ice for the platform's arcade. Tap the top of the screen (or press space or up) to jump the spikes; tap
the bottom (or press down) to slide under the icicles; take the shards. The world speeds up the further you get. It is client-only:
no server, no network, nothing stored by the game itself (the platform keeps progress and milestones).

## Layout

```
src/rules/     the rules, as a pure seeded state machine (a GameVerifier): constants, world, physics, tick, milestones, index
src/session.ts one run as a player plays it: ticks, choices, and the run record they make
src/screen/    drawing, the 30-a-second clock, and the keys and touches
src/main.ts    joins the page to the platform (progress, milestones, runs)
src/replay.ts  the verifier the platform replays runs with (rules + one sample run)
```

## Keys, sound and pause

Up, W or space jump and down, S or shift slide (or touch the top or bottom of the screen); Enter starts a run, P pauses, and a hidden tab pauses.
The music is a running loop and each action, shard and hit has an effect (`src/audio.ts`, played by the SDK's sound engine, with the panel at the
bottom left). The sound settings are kept beside the best distance. The page runs on the SDK's run loop (`createRunLoop`), so pausing stops the clock;
`src/feedback.ts` says which sounds a tick's changes deserve. None of this is in the rules, so it does not change the verifier's digest.

## How runs are checked

The rules know only ticks (thirty a second) and whole numbers; the same seed and choices always play out the same way. The platform
gives a run its seed, the game records only the choices (jump, slide, end) with the tick each was made on, and on `run.submit` the
platform replays the record with the published verifier. A milestone the replay earns is held as replay-verified, which shows the run
followed the rules, not that a person played it. The verifier's SHA-256 is pinned in `configs/games/frost-runner.ts`; changing the
rules changes the digest, and a test fails until the pin and `verifierVersion` are updated together.

## Milestones

23, all decided by the state of a run alone (`src/rules/milestones.ts`): distance (100 m to 3,000 m), shards, obstacles passed, close
calls, jumps and slides, time alive, and top speed. The words are in the manifest. The owner approved the list on 2026-10-29.

## Tests

`pnpm --filter @game/frost-runner test:unit`, `test:integration` (bundles the page and runs it against a simulated platform),
`test:coverage`. `test/support/bot.ts` is a careful player: the fairness test needs it to get a kilometre and a half on five seeds, so a
change that makes the game unplayable fails.

## Ownership

Platform games team.
