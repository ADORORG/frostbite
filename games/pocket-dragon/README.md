# Pocket Dragon: Glitchy's Quest

An original, family-friendly adventure for the platform's arcade, starring Glitchy, a mysterious baby dragon, in three levels that change
dimension as they go: a side view, a map from above, then a maze seen through Glitchy's eyes. **The whole quest** plays them as one run
against one clock: clear Egg Hills and its last portal shifts Glitchy into a new dimension, the Guild and the Castle; clear that and it
turns into the third dimension, the Whispering Woods. The hearts Glitchy has left carry from level to level, and losing them all (or
running out of a level's time) ends the quest. Win fast, with hearts to spare, for a place in the **Hall of Fame** (the ten best won quests,
by score and then time, saved with the progress). A level cleared in the quest (or alone) opens it to practise on its own with 1, 2 or 3;
only the whole quest reaches the Hall of Fame. It is client-only: no server, no network, nothing stored by the game itself (the platform
keeps progress and milestones). Nobody is ever hurt: a grumpy creature is cheered up, a beaten ghost dragon turns to sparkles, a guard
goes home dizzy, a bump costs a heart, and a tired guild takes a nap. The villain is DeFu, who wants every dragon egg for her rocket.

1. **Egg Hills** (a side-scrolling platformer). Run and jump across three stages: catch eggs and the golden egg on its high ledge, eat the
   fire berry, breathe fire to melt ice walls, and cheer up the gloomlings (land on them or puff fire at them). Each stage has its own
   weather: strong wind on the first (gusts, mostly against Glitchy, with calm between), heavy rain on the second (slippery grass, and
   fire puffs fizzle sooner) and deep fog on the third (only what is near Glitchy shows). Three hearts, a nest halfway that keeps your
   place, and a heart back after stages one and two.
   - **DeFu.** Each stage ends in her arena under her high ledge, and the portal stays sealed until her baby ghost dragons are
     beaten (three hits each, by landing on them or with fire). Before she strikes, her eyes glow red and the spots are marked on the
     ground; then her lasers come down there. She makes it harder each time: one ghost dragon and slow strikes on stage one; two ghost
     dragons, three security guards sent down one after another and strikes on two spots on stage two; and on stage three five guards,
     strikes on three spots and an egg rocket full of eggs. Six hits burst the rocket and set a dozen eggs free to catch.
   - **Secret charms.** One per stage, up cloud steps away from the path, showing itself only up close: a feather (stronger jumps), a
     shield (takes one bump for Glitchy) and a magnet (draws metaplasma from far off).
   - **Secret areas.** Every stage hides two, past its end behind walls and reached only by their doors: a burrow in the ground (it
     shows only up close; press down on it) digs into a cave tunnel of eggs and cave gloomlings whose ladder comes up at the nest, and a
     spring mushroom bounces Glitchy up into a swirl cloud and the sky islands, cloud steps of eggs with a rainbow down at the far end
     (falling off a cloud floats Glitchy down unhurt). The weather and DeFu's fight wait while Glitchy is in one.
   - **Power-ups and obstacles.** Wings (ten seconds of flapping: press jump in the air) and a forcefield bubble (ten seconds when
     nothing hurts, and a gloomling or guard bumped is cheered up) on every stage; steam vents that puff on and off, and from stage two
     boulders rolling to and fro (jump them, or land on top to bounce).
2. **The Guild and the Castle** (a small role-playing quest on a map seen from above). Find what four dragon friends want so they join your
   guild, then use their powers (Bolt pushes boulders, Splash grows lily pads, Bloom parts brambles, Spark lights up a show) to get out of
   the woods. Cheer up three grumble guards and the Grumble King and raise your banner on the castle.
   - **Cheer battles.** Each keeper is met on its own background (the courtyard, the torch hall, the starry tower and the throne room),
     with its grumble and the guild's spirit as bars. Each turn, put on a show (each keeper has a favourite, which counts twice, and a hint
     says which), a quick cheer (only one, but the keeper's grumble back is only one too) or evade (its next grumble misses). The same show
     twice running is too tired to work. The keeper grumbles back after each move; a guild out of spirit naps and tries again.
   - **Secret charms.** Three on the land, kept for the battles and used at once without taking a turn: spirit (back to full), a star (the
     next show counts three times) and a shield (blocks two grumbles).
3. **The Whispering Woods** (a maze seen through Glitchy's eyes). Read three clue stones and find the four parts of the egg launcher to
   open the moon gate before the moonlight runs out (six minutes); collect eggs for the launcher on the way, open five chests, light three
   lanterns with fire and melt the frozen hedge that hides the moon chest. Three secret charms hide in dead ends: swift feet (walk faster),
   the whole map (the map shows every path, and where the parts and eggs still are) and a metaplasma magnet. Out of the gate, the launch
   round: tilt the launcher with up and down, set its power with left and right, and launch the eggs found at three baskets (100, 200 and
   300 points), a ring (400) and a high star (500) within thirty seconds. The bonus adds to the level's score.

**Metaplasma** is in every level: little bits of light that drift to Glitchy like pollen when it comes close. The page banks what every
run gathers ("Metaplasma banked"), to be turned into items one day, which will take a tremendous amount; for now it is only counted.

## Your card

Between runs, **Share card** makes a picture to post: a square (1:1), a story (9:16) or a wide post (16:9). At its heart is a trading card
of the game's own design: Glitchy's name and title, the run's score, a picture of the level with a stamp (cleared, try again, won it
all), two moves made from the run's counts, a quote of the game's own, and a foil frame by rarity: a spark for a run that fell short, a
flame for a cleared level, a blaze for winning the whole quest, and masterful once the masterful charm is earned. A quest's card shows its
time and the hearts kept as its two moves. Around it go a headline, the
trophy shelf (the milestones the run earned, each with a cup coloured by where it was won, or every trophy held on a card of the quest
so far), the three levels (cleared, open or locked, with their bests), the metaplasma banked, and an invitation. Before any run of a
visit, the card is of the quest so far.

The invite link is the platform's own page for the game. The game is never told the platform's address, so it reads it from the page
that frames it (its referrer) and only when that is the game's page (`/games/pocket-dragon`); anywhere else the card says to find the
game in the arcade instead. The platform's frame is `sandbox="allow-scripts"` with no `allow-downloads` and no `web-share`, so there
the Download and Share buttons are stopped by the browser and the clipboard may be refused; the panel says to save the picture from the
browser's own menu on the image (right-click, or press and hold), and the link is shown to select and copy. Letting the buttons work on
the platform is a change to the frame (`features/games/src/ui/game-player.tsx` and `packages/game-sdk/src/frame-headers.ts`) for its
owners to weigh. A won quest is saved with the progress, so a card can say so in a later visit.

## Controls

Arrows or WASD to go, an action key (space or Z) and a fire key (F or X). In Egg Hills left and right run and up or the action key jumps
(hold for a high jump, tap for a hop), down digs into a burrow, and with wings jump flaps in the air; in the woods up and down walk and left and right turn, and in the launch round up and down aim, left
and right set the power and fire launches; in the castle the arrows walk and the action key talks and picks up. In a cheer battle the
arrows move through the menu and the action key chooses, or the hotkeys act at once: 1 to 5 for the shows, Q a quick cheer, E evade and C
a charm. Enter starts a run, P pauses, and between runs 0 chooses the whole quest and 1, 2 and 3 a level open to practise. On a touch
screen there are buttons for the actions the level on the screen uses (in the quest they change with the level). M and N turn the music and the effects off and on; the sound panel is at the bottom left. The card panel takes
its own keys while it is open (Tab to move, Enter or Space to press, Escape to close), so none of them start a run.

## Layout

```
src/rules/          the rules, as pure seeded state machines (each a GameVerifier), joined into one verifier with a cabinet per level and
                    one for the whole quest
  held.ts           what the three levels share: controls pressed and let go of on a tick, the run closed with `end`
  plasma.ts         metaplasma: motes that drift to Glitchy and are gathered, the same in every level
  shared-marks.ts   the two marks every level can earn: a secret charm found, and 300 metaplasma in one run
  hills/            Egg Hills: constants, types, layout, secret-layout and level (the seeded stages and their secret areas), collide,
                    hero, weather, fire, boss and boss-meet (DeFu's fight), secrets (doors, power-ups, springs, vents, boulders),
                    touch, tick, state, milestones
  woods/            the woods: trig (whole-number sines), maze (the seeded maze), stash (parts, eggs, charms, metaplasma, targets),
                    walk, tick (walking, fire, finding), launch (the launch round), milestones
  castle/           the guild: map, places, motes, world (walking, bumping, talking), battle (cheer battles), tick, milestones
  quest/            the whole quest: keys (presses written compactly), legs (each level as the quest plays it), tick (the shift
                    between levels, hearts carried, won and lost), milestones, index (the quest's verifier)
  milestones.ts     every milestone id, in the manifest's order
src/chapters.ts     what the page needs of each level to play it, and their names
src/session.ts      one run of a level as a player plays it: ticks, control changes, and the run record they make
src/quest-session.ts the whole quest as a player plays it, its presses written into `keys` inputs sixty-four at a time
src/screen/         drawing each level (a side view, a map from above, a raycast first-person view), at twice the size for sharp words;
                    quest-draw adds the quest's clock and hearts, the shift into the next dimension and how the quest ended
src/card/           the player's card: words, content (what a card says, from the progress and the last run), trophy-list, invite,
                    layout (the three sizes), paint (blocks, sparkles, foil, type), art, frame and frame-text (the trading card),
                    trophies (the shelf), badges (the levels) and poster (the whole picture)
src/page/           the page: the keys and touch buttons, a level's run and the quest's run as the page sees them (runs, quest-run),
                    settle (what a finished run changes), what is shown around the screen (view, with the Hall of Fame), and
                    card-panel (making, saving and sharing a card); its styles are in `card.css`
src/main.ts         joins the page to the platform (progress, milestones, runs) and runs it on the SDK's run loop
src/audio.ts        a tune for each level and the effects, as data for the SDK's sound engine; `feedback.ts` says which to play
src/progress.ts     what is saved: levels open to practise, the quest won, the best of the quest and of each level, the Hall of Fame,
                    the metaplasma banked, the sound settings
src/replay.ts       the verifier the platform replays runs with (rules + one sample run)
```

## How runs are checked

The rules know only ticks (sixty a second) and whole numbers: a pixel of Egg Hills is sixteen subunits, a cell of the woods is 256 and a
turn is 1,024 steps with a cosine table written out as integers, and the castle is a grid of tiles. Every level, maze, boss fight, hiding
place and keeper's favourite show is laid out from the seed alone; a run record holds only when a control was pressed or let go of, and
the rules play the ticks between. A record names what was played in its settings (`{ "cabinet": "hills" }`, or `"quest"`), and the one
published verifier (`src/rules/index.ts`) replays it with those rules. A quest can be half an hour long, so its presses are written
compactly to stay inside a record's 64 KB: one `keys` input holds up to sixty-four, each as the ticks since the one before and a letter
(`"12R30r0J"`: right pressed on tick 12, let go on tick 42, jump pressed on tick 42). The quest plays each level with that level's own
rules, so a level plays the same in the quest as alone; between levels the dimension shifts for three seconds, when nothing is taken,
and the next level starts with every control let go of. A whole quest won by the test bots is about 3 KB and replays in a tenth of a
second. The platform gives a run its seed and, on `run.submit`, replays the record; a
milestone the replay earns is held as replay-verified, which shows the run followed the rules, not that a person played it. The
verifier's SHA-256 is pinned in `configs/games/pocket-dragon.ts`; changing any level's rules changes the digest, and a test fails until
the pin and `verifierVersion` are updated together. The metaplasma banked is kept by the page with the rest of the progress; the rules
count what a run gathers, but the bank is not a milestone and is not checked.

## Milestones

Thirty-nine, all decided by the state of a run alone (`src/rules/*/milestones.ts`). Egg Hills has eleven of its own: eggs, golden eggs,
fire, ice melted, gloomlings cheered, the hills cleared, a clear without a bump, guards cheered up and the rocket's eggs freed. The woods
have ten: clues, chests, lanterns, the moon chest, getting out, getting out within three minutes, getting out with every treasure, the
launcher built and a bonus of 1,000. The guild has twelve: friends, the river, the brambles, guards cheered, the castle captured, without
a nap, a perfect pick, within four minutes, an evade, a charm used, and the **Masterful Pocket Dragon Charm**, for
capturing the castle with every friend, every secret charm found, no nap, and every keeper won over with its favourite show first. Two
more can be earned in any level and are named once: a first secret charm, and 300 metaplasma in one run. The whole quest earns every
level's marks on the way (the same as each level played alone) and four of its own: winning it, winning without losing a heart, winning
with exactly one heart left, and winning in ten minutes or less. Some are earned on the same
tick as a level's clear, but each asks for something more than the clear. The words are in the manifest. The list is a draft for the
owner to approve.

## Fairness

The tests hold what the generators guarantee: in Egg Hills the fire berry always comes at least six tiles before the first ice wall, pits
are at most two tiles wide, every stage has a golden egg on a ledge, a nest halfway, a secret charm with a ledge to reach it from and an
arena with nothing else in it, every run has at least 90 eggs, 15 blocks of ice and 8 gloomlings, and stages get more pits and faster
gloomlings as they go; in the woods every path cell can be reached, the parts, eggs and charms are each on their own cell that Glitchy
can walk to, the moon chest is a dead end behind the frozen hedge, and nothing shuts Glitchy in at the start. Players who see what is
coming (`test/support/*-bot.ts`) earn every milestone of each level on the seeds tried, and their records replay through the published
verifier to the same milestones: Egg Hills, all three of DeFu's fights included, without a bump; the woods with everything found and
a bonus over 1,000; the castle with the Masterful Pocket Dragon Charm; and the whole quest, won in about four minutes with every heart
(`test/support/quest-bot.ts` plays each level with its own bot on the quest's clock). A player who puts on the weakest shows and leaves a friend and the
charms behind still captures the castle, after a nap. Nobody has played it as a person yet.

## Tests

`pnpm --filter @game/pocket-dragon test:unit` (the rules, the stages, the quest, the screen and the page's parts), `test:integration`
(bundles the page and plays it against a simulated platform, including a quest on the platform's seed that is sent back and replayed),
`test:coverage`.

## Ownership

Platform games team.
