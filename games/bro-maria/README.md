# Bro Maria

An original side-scrolling platformer for the platform's arcade (the working title is the owner's; it is close to a well-known game's name and
may need another before the game is listed publicly). A hero runs and jumps across a level of icy ground: take shards, land on slimes, bump
crates from below, clear the pits, and reach the lantern at the far end. Three lives; a lantern halfway keeps your place. It is client-only: no
server, no network, nothing stored by the game itself (the platform keeps progress and milestones). No art, level, name or sound is taken from
another game.

## Controls

Arrows or A and D run, space or up or W jump (hold for a high jump, tap for a hop), Enter starts a run, P pauses. On a touch screen there are no buttons: a drag on
the left half of the screen runs the way it goes (`src/screen/thumbs.ts`, a thumb stick that follows the finger), a hold on the right half jumps, and
a tap on the waiting screen starts a run. A pause icon and the two sound icons sit in the top right corner. M and N turn the music and the effects off and on; the sound panel is at the bottom left.

## Layout

```
src/rules/     the rules, as a pure seeded state machine (a GameVerifier): constants, types, level (the seeded layout), collide, hero (running,
               jumping, falling), tick (the world: coins, slimes, crates, pits, lanterns, the goal), state, milestones, index
src/session.ts one run as a player plays it: ticks, key changes, and the run record the changes make
src/screen/    drawing (backdrop, sprites, the world), and the keys and touch buttons
src/main.ts    joins the page to the platform (progress, milestones, runs) and runs it on the SDK's run loop
src/audio.ts   the music and effects, as data for the SDK's sound engine
src/replay.ts  the verifier the platform replays runs with (rules + one sample run)
```

## How runs are checked

The rules know only ticks (sixty a second) and whole numbers (a pixel is sixteen subunits). The level is laid out from the seed alone; the
run record holds only when a control was pressed or let go of, and the rules play the ticks between. The platform gives a run its seed,
and on `run.submit` replays the record with the published verifier. A milestone the replay earns is held as replay-verified, which shows the
run followed the rules, not that a person played it. The verifier's SHA-256 is pinned in `configs/games/bro-maria.ts`; changing the rules
changes the digest, and a test fails until the pin and `verifierVersion` are updated together.

## Milestones

40, all decided by the state of a run alone (`src/rules/milestones.ts`): how far you got (nine places, the end among them), shards (7 steps up to
65), slimes (stomps from 1 to 10, every slime in the level, and two or three in one bounce), crates (1 to 8), and the ways to finish (clean,
without a fall, after a setback, on the last life, within 60, 45 or 42.5 seconds, without a stomp, with every shard, with a bit of everything)
plus two for a good start. Every level has enough shards, slimes and crates for each to be possible. Three are for near-perfect play and no
bot reaches them (every slime, no stomp, every shard). The words are in the manifest. The list is a draft for the owner to approve.

## Fairness

`test/level.unit.test.ts` holds what the generator guarantees (a pit is one or two tiles with three flat tiles either side, a step is one tile,
every slime and urchin has flat ground, and every level has at least 60 shards, 10 slimes, a trio of them and 8 crates) and
`test/fairness.unit.test.ts` the balance: a plain bot that holds right and jumps at what is close finishes at least 95% of levels, in about
the time it takes to run across, while a hero that only runs never does.

## Tests

`pnpm --filter @game/bro-maria test:unit`, `test:integration` (bundles the page and plays it against a simulated platform), `test:coverage`.

## Ownership

Platform games team.

## Stages

A run is six stages, one after another, each laid out from the run's seed and its number (`src/rules/level.ts`, `layout.ts`). Stage one is the plain level (flat runs, pits, steps, platforms, crates, single urchins and slimes). Each stage after is harder: slimes walk faster (6, 7, 9, 11, 13, 15; the hero runs at 20) and are closer together, and the mix of stretches gains urchin pairs, a pit with an urchin beyond it, an urchin with a pair of slimes behind it, a two-tile climb and pits three tiles apart, until the easy stretches are gone. A stage has its own lantern. The hero has three lives for the whole run, a life is won on clearing stage two and stage four (to at most five), and a hit or a fall costs one. The run is at most eight minutes.

The forty milestones are for the whole run (shards, stomps, crates), stages cleared, and how stages were played (clean stages, fastest stage, a stage with every shard). The verifier is version 2.

Measured (`test/support/planner.ts`, `test/fairness.unit.test.ts`): a player who tries each jump on a copy of the game before making it clears every stage of every seed tried without a hit or a fall, and all six in a row with five lives; a plain player who holds right and jumps at what is close loses more lives stage by stage and finishes about one run in six. Nobody has played it as a person.
