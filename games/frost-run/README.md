# Frost Run

A small 3D game for the platform's arcade: three rounds on the ice, sixty seconds each, gathering mint crystals, frost eggs and keys while
snowballs roll in faster every fifteen seconds. Hold nine in ten of every treasure across the run to win. It is client-only: no server, no
network, nothing stored by the game itself (the platform keeps the best score, the sound settings and the milestones). Nobody is hurt: a hit
knocks the hero back and costs five seconds, and a fall into the water puts the hero back on the ice.

The art is low-poly and flat-shaded with no textures, made in Blender by the scripts in `art/blender/` and drawn with three.js. The titles,
the heroes' names and numbers, the words and the milestones are a draft for the owner (see `DECISIONS.md`).

## The run

1. **The Floe** (move, hop, duck). An ice floe about twenty metres across with rocks round its edge. Snowballs drop in at the rim and roll
   across; from the second wave some are aimed at the hero, and icicle darts fly in at head height after a warning line. Hop the snowballs
   and duck the darts.
2. **Shatter Sound** (roll, shoot, hover). A middle island and five islets in open water. Hold hop in the air to hover across the gaps,
   duck while moving to roll, and shoot frost bolts. Five ice crates hold treasure and break to a roll or a bolt.
3. **The Aurora Crown** (grow, frost vision). A plateau under the aurora with four spires and five ice cages. Grow for a few seconds to
   break a cage by walking into it and to crush what rolls at you; frost vision slows the world to a third and shows four ghost keys that
   cannot be seen or taken without it. Every fourth snowball is a giant.

Each round has eight crystals, five eggs and four keys: 24, 15 and 12 across the run, of which a win needs 22, 14 and 11. A round ends
when its clock runs out or when it is swept clean, and the seconds left on a swept round are added to the score (a crystal is worth 100,
an egg 150, a key 200). The orange flash is the crystal's alone: nothing else in the game is orange.

### Heroes

Five heroes play by the same rules with a few numbers changed (`src/rules/leads.ts`), and every one can win (a test plays a winning run
with each).

| Hero  | What it is           | Its edge                                                                    |
| ----- | -------------------- | --------------------------------------------------------------------------- |
| Volt  | Neon holographic ram | Runs and rolls fastest; its roll breaks even the giant snowballs            |
| Nib   | Baby dragon          | Hovers far longer; its frost bolts fly further                              |
| Lumen | Spirit miner         | Takes treasure from further off; frost vision lasts longer                  |
| Hrimm | Ice giant            | A hit costs three seconds, not five, and barely moves him; grows for longer |
| Pip   | Snow creature        | The first hit of every round costs nothing                                  |

### Controls

| Action                           | Keys             | Touch              | Gamepad                 |
| -------------------------------- | ---------------- | ------------------ | ----------------------- |
| Move                             | Arrows or WASD   | Drag anywhere      | Left stick or the cross |
| Hop, hold in the air to hover    | Space            | HOP                | A                       |
| Duck, roll while moving          | Shift or C       | DUCK               | B                       |
| Shoot                            | F or J           | SHOOT              | X                       |
| Grow                             | G or K           | GROW (one button   | Y                       |
| Frost vision                     | V, L or E        | with SEE, in turn) | Either shoulder         |
| Start, choose a hero, play again | Enter (or Space) | Tap the screen     | A or Start              |
| Turn the hero ring               | Left and right   | Swipe              | Left and right          |
| Pause                            | P or Escape      | The pause icon     | Start                   |

On a touch screen the first screen keeps to the platform's three icons: the hero select has no buttons of its own there (a swipe on the
screen or the card turns the ring, a tap plays), and after a run a tap plays again. The four thumb buttons are there from the first
screen (out of sight until a run starts, so nothing moves under a thumb when one does), and a button the round has not taught yet is
dimmed. The first screen's card is drawn in the room the hero select leaves, and the camera frames the turntable's hero between its
lines, on a phone held either way.

## Layout

- `src/rules/`: the rules, a pure seeded state machine in whole numbers (millimetres and ticks, sixty a second): the same seed and inputs
  always give the same run. `levels.ts` lays out the three rounds, `leads.ts` the heroes, `spawn.ts` and `hazards.ts` what is thrown,
  `player.ts` the hero, `round.ts` the treasure and the clock, `milestones.ts` the milestones, `index.ts` the verifier.
- `src/session.ts`: one run as the player plays it, and the run record its hands make (a change of the hands is recorded only when it
  changes, at least three ticks apart, so the busiest run stays inside what a record may hold).
- `src/screen/`: the 3D screen (three.js): the stage and its quality ladder, the three arenas, the heroes and their clips, what is thrown,
  the treasure, the effects, the snow and the camera. `flat.ts` draws the same run from above with a 2D canvas where there is no WebGL 2.
  `models/packed.ts` is the models as text, written by `art/blender/pack.py`.
- `src/ui/`: the hero select, the readouts, the first-screen card (on the SDK's guide layer), the card after a run, the share card, and
  the hands (keys, drag, thumb buttons, gamepad).
- `src/platform.ts`, `src/view.ts`, `src/page.ts`, `src/main.ts`: what the page asks of the platform, which screen draws, the page's
  parts, and the wiring between them.
- `src/audio.ts`, `src/cues.ts`: sound as data, and which sound (and whether the orange flash) goes with each thing that happens.
- `src/replay.ts`, `src/sample-run.ts`: the verifier the platform replays and the run it is published with; the manifest pins its digest.
- `milestones/`: one drawing for each milestone, in the platform's strict SVG subset, written by `art/milestones.py`.
- `assets/`: the cover (a still staged with the game's own models and screen code) and the notice for three.js.

## The art

`art/blender/build_all.py` builds every model in Blender, each in a scene of its own (five rigged and animated heroes, the three arenas,
the crystal, egg, key, crate, cage, snowball, dart and bolt), exports each as a `.glb` to `art/out/` and saves `frost-run.blend` there.
`art/blender/pack.py` then packs them into `src/screen/models/packed.ts`, because the frame a game runs in may load no files: normals are
dropped (every face is flat), equal corners are welded, colours and weights become bytes, still meshes are stored as 16-bit numbers in
their own box, and animation keys a straight line already gives are dropped. `art/out/` is not committed; run the script to make it again:

    blender --background --python art/blender/build_all.py

A test (`test/models.unit.test.ts`) checks that every packed mesh keeps bounds that hold all of its points, so three.js never leaves out
ground that is still in the picture.

## How runs are checked

Every milestone is decided by the rules alone, from the run's state. The game publishes its rules as a verifier (`src/replay.ts`); the
platform replays a run it issued a seed for, and holds the milestones that replay earns as replay-verified. That shows the run followed
the rules, not that a person played it. A run outside the platform (or one the platform gave no seed for) is played on a seed of the
page's own and is sent nowhere.

## Milestones

Twenty-three, each earned once: the first crystal, egg and key; each round swept clean; a run with every treasure; the Floe without a
hit, and swept with 25 seconds left; ten snowballs hopped; eight darts ducked; a close shave; two crystals within a second and a half; all
five islets; all five crates; twelve snowballs or darts smashed; all five cages; all four ghost keys; and a win with each of the five
heroes. There is none for a win as such: a win is always some hero's win, and one event earns one milestone.
`test/milestones.unit.test.ts` has bots earn every one.

## What the frame forbids

The platform's frame allows no downloads and no share sheet, so the share card (square or story) is shown as a picture to save by a long
press or a right click. `DECISIONS.md` names the platform change that would allow a button.

## Test commands

`pnpm --filter @game/frost-run test:unit`, `test:integration`, `test:coverage`.

- Rules, session and milestones: positive, negative and boundary cases; the same seed and inputs give the same run; bots earn every
  milestone and weak play still finishes.
- The 3D screen with a renderer that draws nothing (a test has no WebGL), the flat screen and the cards on a recording canvas, and the
  panels and hands in jsdom.
- The bundled page against a simulated platform (`test/*.integration.test.ts`): it connects before it lets a run start, plays a run on
  the platform's seed, sends it once and saves the best once.

## Ownership

The game's author owns it; the platform games team reviews every game before it is merged.
