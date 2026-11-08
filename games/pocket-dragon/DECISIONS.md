# Pocket Dragon: decisions for the owners

What the reviews on PR #1 asked to have decided, with what the game does now. Each item says what is proposed and what is wanted from
the owners. Items 1 to 4 need an answer before the game is listed; item 5 is a note.

## 1. three.js for the woods in 3D (proposed: keep it)

**What.** `three@0.187.0` at run time and `@types/three@0.187.0` for the tests, both pinned to the exact version. Only `src/three/` (14
files, about 2,500 lines) imports it, sixteen names in all. Out of the maze, the third level is drawn by it: the camera that comes into
play, flying low and soaring, frost vision's three futures and Sparky. The rules never touch it.

**Why three.js.** The options were:

- **Our own WebGL2.** No dependency, but shaders, shadows, lights, models and the camera's paths would be several thousand lines of our
  own to keep working.
- **The maze's 2D raycaster, stretched further.** It cannot show heights, flight or a camera that sweeps.
- **Babylon.js.** It does the same job, with a larger bundle and a heavier API.
- **Smaller libraries (OGL, regl).** They are less used and have fewer maintainers, and we would write more of our own lighting and
  shadows.

three.js is the most used WebGL library. Its ES modules tree-shake and it ships TypeScript types. It needs nothing the game's frame
forbids: no network, no storage, no workers, no other address. Where WebGL2 is missing or fails, `createDepthView` returns null and the
woods are drawn flat (`src/screen/woods-base.ts`), so the level is still played the same.

**Size.** The bundle sizes below were measured with esbuild's metafile, with the SDK's minifying settings.

| Bundle                                                 |     Minified |         Gzip |
| ------------------------------------------------------ | -----------: | -----------: |
| `main.js`                                              |     1,227 KB |       318 KB |
| `main.js` without three.js                             |       676 KB |       180 KB |
| three.js's share                                       |       551 KB | about 138 KB |
| Bro Maria, Shard Match or Aurora Pulse, for comparison | about 470 KB | about 100 KB |

The verifier has none of it: it is the rules only, and `test/game.integration.test.ts` keeps it under 200 KB.

**Licence.** MIT. The SDK's build drops comments from the bundle (`legalComments: "none"`), so the game ships the notice the licence
asks for as a file of its own: `assets/third-party-notices.txt`. A wider fix, for any game that bundles a library, would be for the SDK
to keep legal comments (`legalComments: "eof"`). That is the owners' change to make, not this PR's.

**Maintenance.** three.js releases about once a month, and the pin means an upgrade is always on purpose. To upgrade, change both pins,
run `three-world`, `three-stage`, `three-effects` and `flight-three`, and look at the woods in a browser. Nobody has played the 3D woods
on a low-end phone yet, as the review says. If it is slow there, the first step is to turn shadows off on small devices
(`renderer.shadowMap.enabled`). The pixel ratio is already capped at 2.

**Wanted:** approval to add three.js as a game dependency. The alternative is to have the woods outside the maze drawn flat only. That
view exists already; dropping three.js cuts 551 KB but loses the camera and the flying.

## 2. Test mode and the admin key's hash in the page (proposed: keep it)

**What.** Holding the title for two seconds asks for the admin key. The right key opens every level, and in a test run hearts are never
lost and the rocket never leaves. `src/test-mode/key.ts` holds only a salted PBKDF2-SHA-256 hash of the key (600,000 rounds). The key is
the admin's own, long and random, and it is in no file, commit or manifest.

**Why a hash in the page is acceptable here.** The game runs in the browser, so anyone could turn test mode on by editing the page in
their own browser, with or without the key. It can only be safe if test mode wins nothing:

- **No platform run.** A test run asks the platform for no run, and nothing is sent when it is left. `test/submit.integration.test.ts`
  checks this.
- **No milestones.** A test run reports no milestone; its session has no `onEarned`.
- **No saved changes.** It changes no progress or Hall of Fame; `finish` returns before `settle`.
- **No test mode in the verifier.** A record of a test run would replay to nothing.

The hash keeps the key itself out of the page. The slow hash and the long random key make guessing it from the hash impractical.

**Does the shipped game need it?** It lets the admin check the late levels on the real platform build, on a phone or a desktop, without
playing through. On a touch screen the title is hidden, so for now it opens only where there is a mouse.

**Wanted:** one of these.

- Keep it as it is.
- Leave it out of the shipped build and keep it for the local dev host only. That needs a build flag the SDK does not have yet.
- Remove it.

## 3. The milestones (wanted: sign-off)

There are forty milestones, the platform's most, all decided by run state alone. They are listed in `configs/games/pocket-dragon.ts`
and described in the README, and `milestone-arts/` has the drawing each becomes on chain, numbered in the manifest's order (each passes
the platform's drawing check unchanged; the largest is 3,765 bytes). The titles, the summary and the drawings are a draft. **Wanted:** the owner's sign-off on the
list, its titles, its words and its drawings once the game has been played on a phone. Changing a milestone after it is published is not
allowed, and a defined milestone's drawing never changes, so this has to happen first.

## 4. Levels and the Bag on a phone (proposed: one tab, kept in sight)

**What.** The latest review asks how the levels menu and the Bag fit the phone guard's limit of three things to press, or whether they
move onto the screen or into `attachTouchButtons`. The game keeps both, as one tab in the bottom left corner that is always in sight:
**Levels** between runs (the quest and the levels on a sheet over the screen, with Share card), and **Bag** during a run that has a
backpack (its three foods slide out beside it). The two handles share one place, so nothing moves when one takes over from the other,
and neither is inside the screen, so a finger on them never reaches the thumbs. Everything else is the SDK's: its zones, tap to start,
the first-screen card and the card after a run on the guide layer, the icons of `phone.css`, and its touch buttons for the woods outside
the maze (fly up, fly down, frost vision, Sparky) and the Sky Nursery (ink, clear).

**Against the guard.** It measures a page as it loads. Pause is shown once there is a run to pause (while it is disabled it is hidden,
and its place is kept), so at load there are three: the two sound switches and Levels. During a run there are four (pause, the sound
switches and the Bag), and out of the woods' maze eight, with the SDK's four touch buttons, the most it allows.

**Why not elsewhere.** The levels are chosen between runs only. The foods are three actions on top of the right thumb's two, so as zones
on the screen they would take the thumbs' room, and out of the maze the four touch buttons are taken by flying, vision and Sparky.

**Wanted:** whether four things to press during a run (eight out of the maze) is acceptable. If the guard should hold during a run too,
the Bag would become one touch button that uses the foods in turn, and Levels would stay as it is.

## 5. The size of the PR (proposed: one PR, described by feature)

The game is new, so nearly all of its files are new files under `games/pocket-dragon`. Outside it there are only these:

- the manifest, `configs/games/pocket-dragon.ts`
- one line in `configs/games.ts`
- the lockfile entries for three.js and the game's two workspace packages
- the game's two entries in the desktop layout fixture for the games' layout guard

The later features each touch the rules of all three levels and the quest. The backpack, flying, frost vision, Sparky, the Sky Nursery,
test mode and the cards are examples. Splitting them out would mean reviewing pieces that only work together. The PR description now
maps the files by feature instead. If the owners still want a split, the natural cut is the three levels and the quest first, then the
extras, in that order.
