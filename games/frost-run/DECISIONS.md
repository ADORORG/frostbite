# Frost Run: decisions for the owners

What this game asks the owners to decide, with what it does now. Items 1 to 4 need an answer before the game is listed; items 5 to 7 are
notes.

## 1. three.js for the rounds in 3D (proposed: keep it, at Pocket Dragon's pin)

**What.** `three@0.187.0` at run time and `@types/three@0.187.0` for the tests, the same exact pins Pocket Dragon's decision record
already argues for, so the repository carries one version of it. Only `src/screen/` and `src/view.ts` import it. The rules never touch it.

**Where WebGL is missing.** `createView` fails over to `src/screen/flat.ts`, which draws the same run from above on a 2D canvas, with the
same sounds and the same orange flash. A run is the same run either way, so nothing is lost but the look, and the page tests (jsdom has no
WebGL) play on it.

**Licence.** MIT. The SDK's build drops comments from the bundle, so the notice ships as a file: `assets/third-party-notices.txt`.

## 2. The size of the bundle (proposed: accept it for now)

| Bundle                         | Minified |   Gzip |
| ------------------------------ | -------: | -----: |
| `main.js`                      | 2,342 KB | 692 KB |
| the models in it (`packed.ts`) | 1,161 KB | 401 KB |

The frame allows no fetch, so the sixteen Blender models (five heroes, three arenas, the treasure, what is thrown, the props) ship inside
the script as text, written by `art/blender/pack.py`: normals dropped (the loader shades flat without them), positions and animation
quantised, still channels dropped. That took them from 2.6 MB of GLB to the figures above with no visible change. The verifier is the
rules only and has none of this.

**What is wanted.** Whether about 700 KB gzipped is acceptable for a 3D game. If not, the next steps are fewer or lighter models (the
arenas are the largest), or a platform route for a game's binary assets, which would be the owners' change to the frame, not this game's.

## 3. The title (proposed: Frost Run; owners to say if it is too close)

The catalogue already has **Frost Runner**. The player asked for "Frost Run". If the two read as one game, a different title is a
one-line change in the manifest and the page (`Floe Run` was the runner-up).

## 4. Five heroes, not four (proposed: keep Pip)

The brief named four heroes for the select: a neon holographic ram (Volt), a baby dragon (Nib), a spirit miner (Lumen) and an ice giant
(Hrimm). Pip, the round snow creature with a scarf from the first brief, is kept as a fifth and is the default. Each hero has a
milestone for a win, so dropping Pip would drop `win-as-pip` as well, which is safe only before the milestones are defined on the chain.

## 5. Milestones (a draft)

Twenty-three, decided by run state alone, each from one event; titles and descriptions are a draft for the owner. Each has a drawing in
`milestones/`, named for its id, so the staff page's **Define many milestones** takes the folder as it is. `test/milestone-art.unit.test.ts`
checks every drawing against the platform's sanitiser and size limit.

## 6. Sharing (a note)

The frame allows no downloads and no share sheet, so the share card (square or story) is shown as a picture to save by a long press or a
right click. A button would need `allow-downloads` on the game's frame (`features/games/src/ui/game-player.tsx` and
`packages/game-sdk/src/frame-headers.ts`): the owners' change, not this game's.

## 7. The first screen on a phone (a note)

The platform's phone layout check allows only its three icons to be pressed on a phone's first screen. So on a touch screen the hero
select has no buttons of its own: a swipe anywhere turns the ring and a tap plays, and the card says so. The four thumb buttons are there
from the start, out of sight until a run begins, so nothing moves under a thumb when one does. Type is the system's monospace: the frame
loads no outside fonts, and bundling one would add to item 2.
