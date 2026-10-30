# Bro Maria

An original side-scrolling platformer for the platform's arcade (the working title is the owner's; it is close to a well-known game's name and
may need another before the game is listed publicly). A hero runs and jumps across a level of icy ground: take shards, land on slimes, bump
crates from below, clear the pits, and reach the lantern at the far end. Three lives; a lantern halfway keeps your place. It is client-only: no
server, no network, nothing stored by the game itself (the platform keeps progress and milestones). No art, level, name or sound is taken from
another game.

## Controls

Arrows or A and D run, space or up or W jump (hold for a high jump, tap for a hop), Enter starts a run, P pauses. On a touch screen there are
three buttons. M and N turn the music and the effects off and on; the sound panel is at the bottom left.

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

20, all decided by the state of a run alone (`src/rules/milestones.ts`): how far you got (four places and the end), shards (1, 10, 25, 50),
stomps (1, 5, 10, and three in one bounce), crates (1, 5), and five ways to finish (untouched, within 45 seconds, without a stomp, with every
shard, with the last life). The words are in the manifest. The list is a draft for the owner to approve.

## Fairness

`test/level.unit.test.ts` holds what the generator guarantees (a pit is one or two tiles with three flat tiles either side, a step is one tile,
every slime and urchin has flat ground, and every level has at least 60 shards, 10 slimes, a trio of them and 8 crates) and
`test/fairness.unit.test.ts` the balance: a plain bot that holds right and jumps at what is close finishes at least 95% of levels, in about
the time it takes to run across, while a hero that only runs never does.

## Tests

`pnpm --filter @game/bro-maria test:unit`, `test:integration` (bundles the page and plays it against a simulated platform), `test:coverage`.

## Ownership

Platform games team.
