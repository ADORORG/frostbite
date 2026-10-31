# Pocket Dragon: Glitchy's Quest

An original, family-friendly adventure in three chapters for the platform's arcade, starring Glitchy, a mysterious baby dragon. Each chapter
is its own run and asks for more skill than the one before, and clearing one opens the next. It is client-only: no server, no network,
nothing stored by the game itself (the platform keeps progress and milestones). Nobody is ever hurt: a grumpy creature is cheered up, a
bump costs a heart, and a tired guild takes a nap.

1. **Egg Hills** (a side-scrolling platformer). Run and jump across three stages to the glowing portal at the end of each: catch eggs and
   the golden egg on its high ledge, eat the fire berry, breathe fire to melt ice walls, and cheer up the gloomlings (land on them or puff
   fire at them). Three hearts, a nest halfway that keeps your place, and a heart back after stages one and two.
2. **The Whispering Woods** (a maze seen through Glitchy's eyes). Read three clue stones to open the moon gate before the moonlight runs
   out (six minutes); on the way, open five chests, light three lanterns with fire and melt the frozen hedge that hides the moon chest.
3. **The Guild and the Castle** (a small role-playing quest on a map seen from above). Find what four dragon friends want so they join your
   guild, then use their powers (Bolt pushes boulders, Splash grows lily pads, Bloom parts brambles, Spark lights up a show) to get out of
   the woods. Cheer up three grumble guards and the Grumble King with shows (each keeper has a favourite; a hint says which) and raise
   your banner on the castle.

## Controls

The same six actions in every chapter: arrows or WASD, an action key (space, E or Z) and a fire key (F or X). In Egg Hills left and right
run and up or the action key jumps (hold for a high jump, tap for a hop); in the woods up and down walk and left and right turn; in the
castle the arrows walk, the action key talks, picks up and chooses a show, and up and down move through the shows. Enter starts a run, P
pauses, 1, 2 and 3 choose an open chapter between runs. On a touch screen there are buttons for the actions a chapter uses. M and N
turn the music and the effects off and on; the sound panel is at the bottom left.

## Layout

```
src/rules/          the rules, as pure seeded state machines (each a GameVerifier), joined into one verifier with a cabinet per chapter
  held.ts           what the three chapters share: controls pressed and let go of on a tick, the run closed with `end`
  hills/            Egg Hills: constants, types, layout and level (the seeded stages), collide, hero, fire, tick, state, milestones
  woods/            the woods: trig (whole-number sines), maze (the seeded maze), walk, tick (walking, fire, finding), milestones
  castle/           the guild: map, places, world (walking, bumping, talking), battle (cheer challenges), tick, milestones
  milestones.ts     every milestone id, in the manifest's order
src/chapters.ts     what the page needs of each chapter to play it
src/session.ts      one run as a player plays it: ticks, control changes, and the run record they make
src/screen/         drawing each chapter (a side view, a raycast first-person view, a map from above), at twice the size for sharp words
src/page/           the page: the keys and touch buttons, a chapter's run as the page sees it, and what is shown around the screen
src/main.ts         joins the page to the platform (progress, milestones, runs) and runs it on the SDK's run loop
src/audio.ts        a tune for each chapter and the effects, as data for the SDK's sound engine
src/progress.ts     what is saved: chapters opened, the best score of each, the sound settings
src/replay.ts       the verifier the platform replays runs with (rules + one sample run)
```

## How runs are checked

The rules know only ticks (sixty a second) and whole numbers: a pixel of Egg Hills is sixteen subunits, a cell of the woods is 256 and a
turn is 1,024 steps with a cosine table written out as integers, and the castle is a grid of tiles. Every level, maze and keeper's favourite
show is laid out from the seed alone; a run record holds only when a control was pressed or let go of, and the rules play the ticks
between. A record names its chapter in its settings (`{ "cabinet": "hills" }`), and the one published verifier (`src/rules/index.ts`)
replays it with that chapter's rules. The platform gives a run its seed and, on `run.submit`, replays the record; a milestone the replay
earns is held as replay-verified, which shows the run followed the rules, not that a person played it. The verifier's SHA-256 is pinned in
`configs/games/pocket-dragon.ts`; changing any chapter's rules changes the digest, and a test fails until the pin and `verifierVersion`
are updated together.

## Milestones

Thirty, all decided by the state of a run alone (`src/rules/*/milestones.ts`): eleven for Egg Hills (eggs, golden eggs, fire, ice melted,
gloomlings cheered, stages cleared and a clear without a bump), nine for the woods (clues, chests, lanterns, the moon chest, getting out,
getting out within three minutes, getting out with every treasure) and ten for the guild (friends, the river, the brambles, guards cheered,
the castle captured, without a nap, a perfect pick, within four minutes). Some are earned on the same tick as a chapter's clear, but each
asks for something more than the clear. The words are in the manifest. The list is a draft for the owner to approve.

## Fairness

The tests hold what the generators guarantee: in Egg Hills the fire berry always comes at least six tiles before the first ice wall, pits
are at most two tiles wide, every stage has a golden egg on a ledge and a nest halfway, every run has at least 90 eggs, 15 blocks of ice
and 8 gloomlings, and stages get more pits and faster gloomlings as they go; in the woods every path cell can be reached, the moon chest
is a dead end behind the frozen hedge, and nothing shuts Glitchy in at the start. Players who see what is coming (`test/support/*-bot.ts`)
earn every milestone of each chapter on the seeds tried, and their records replay through the published verifier to the same milestones:
Egg Hills in about a minute and a half without a bump, the woods with everything found in about a minute and a half, the castle in under a
minute. A player who puts on the weakest shows and leaves a friend behind still captures the castle, after a nap. Nobody has played it as
a person yet.

## Tests

`pnpm --filter @game/pocket-dragon test:unit` (the rules, the stages, the screen and the page's parts), `test:integration` (bundles the
page and plays it against a simulated platform, including a run on the platform's seed that is sent back and replayed), `test:coverage`.

## Ownership

Platform games team.
