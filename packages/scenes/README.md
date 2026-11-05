# `@frostbite/scenes`

The platform's looping pixel scenes: small animated backgrounds for sections and overlays for cards. Everything about them lives here and
nowhere else. Pages import four things and know nothing else about how a scene is drawn or run.

## Public API

- `@frostbite/scenes/react`
  - `ScenesProvider`: once, at the top of the app. Owns the one frame loop and decides whether scenes move.
  - `SceneBackdrop`: a section's moving background. A scene chosen at random on each visit (never the same as another backdrop on the
    page while others exist), or the one named by `sceneId`. Fills a positioned parent; the page adds its own scrim for text.
  - `SceneOverlay`: a card's overlay. The scene is chosen from the card's `seed` (so a card always looks the same), or named by `sceneId`.
  - `AnimationToggle`: the always-visible on/off switch.
- `@frostbite/scenes/styles.css`: the few rules that place a scene in its box. Imported once by the app.
- `@frostbite/scenes/library`: the scenes themselves and the list of them (`scenes`, `defineScenes`), and `ambient`: scenes that are weather for a page
  (`snowfall`, behind the landing page's headline). They are held to the same tests and rendered to video like the others, but are never in
  the list a person steps through or that is drawn from at random for a card.
- `@frostbite/scenes/engine`: the DOM-free parts (contract, drawing helpers, clock, picking, policy, preference, scheduler), for tooling that
  renders scenes outside a page.
- `@frostbite/scenes/video`: DOM-free parts of the video fallback: `createRaster` (a surface that draws into memory), `framePlan`, `videoFiles`,
  `videoSpec`. Used by `tooling/scene-render`, which writes the files, and by the page, which asks for them by name.

## Layout

```
src/engine/   no DOM, no React: scene.ts (contract), draw.ts, palette.ts, clock.ts, pick.ts, policy.ts, device.ts, preference.ts, scheduler.ts
src/library/  one file per scene, and index.ts (an explicit list; nothing is found by scanning)
src/react/    the provider, the canvas, the backdrop, the overlay, the switch, and the browser stores they read
src/video/    raster.ts (in-memory surface), spec.ts (file names, frame plan)
src/styles/   scenes.css
```

Dependencies point inward: `react/` uses `engine/` and `scenes/`; `engine/` imports nothing. Other packages import this one, never the
reverse.

## How a scene works

A scene is `{ id, name, make() }`. `make()` does one-time work and returns `{ loopSeconds, draw(surface, t) }`. `draw` is a pure function of
`t`, the seconds into the loop, drawn on a 160 x 90 grid with `rect`/`sprite`. A pure function can be drawn at any moment, so a still frame
is one moment, a test can draw the whole loop, and the loop closes without a jump when every scroll speed divides the loop into whole
repeats. Adding a scene is one file and one line in `index.ts`.

## How scenes are run

- One frame loop for the whole page (`createScheduler`). It draws nothing while the tab is hidden, only scenes that are on screen, at most
  `playbackLimits.maxRunning` (6) of the unforced ones (the nearest to the middle of the view), each at its own frame rate (30 for
  backdrops, 20 for overlays). A scene that is not moving shows one still frame.
- Whether scenes move (`playbackFor`): the person's own remembered choice wins; otherwise reduced motion, data saver or a device with 2 GB
  of memory or less (where the browser reports it) shows stills. Until the browser has been asked (the server render) nothing moves.
- The choice is kept in `localStorage` under `scenes:animation`; a missing or failing store only means it is not remembered.
- Scenes are decoration: canvases are `aria-hidden`. The switch is the control for anything that moves for more than a few seconds.

## Where a browser cannot draw

A browser with no 2D canvas plays the scene's video instead (`SceneView` chooses). Pass `videoBase` to `ScenesProvider` (the app's
folder of rendered files, see `tooling/scene-render`). The video is silent, loops, plays only while on screen, and follows the same
switch and device signals: while scenes are not moving it shows the still. If the video cannot load it shows the still, and if that
cannot load it shows nothing. With no `videoBase`, a browser with no canvas shows nothing. The server always renders the canvas version,
which is what a browser that can draw adopts.

## Budgets (enforced by tests)

Each scene file is under 8 KB gzipped and the whole engine under 10 KB gzipped (`test/library.unit.test.ts`). No library, no WebAssembly, no
asset download; the content security policy is unchanged.

## Tests

`pnpm --filter @frostbite/scenes test:unit | test:integration | test:coverage`. The unit tests drive the scheduler by hand, draw every scene
across its whole loop (finite numbers, nothing off screen, same picture every time, closes without a jump where it should), and check the
size budgets. The integration tests run the React parts in jsdom with a stepped frame loop, recording canvases, a controllable
intersection observer, and stubbed media queries.

## The scenes

Falling blocks (a self-solving puzzle), Block builder, Space shooter, Bird hunt, Night street, Brick breaker, Side runner, Retro racer,
Snake, Pong duel and Road hopper. Eleven scenes and the engine together are about 17.7 KB minified, 8.2 KB compressed. All art is generic
and original; nothing is drawn from a known game.

## Every scene closes without a seam

A scene may not fade out or snap back at the end of its loop. Scrolling things move at a speed that divides the loop into whole repeats;
things that are used up (invaders, bricks, puzzle rows) come back during the loop; anything that happens at an instant (a stride, a stripe, a
step) is offset so it does not fall exactly on the moment the loop closes. One test over the whole list holds every scene to this: the last
moment and the first must look the same. It also holds them to the palette, to a draw-call budget per frame, and to the size budgets.

## Not here yet

The overlays on the full listing pages (S4), the video fallback (S5) and the phone/performance checks (S6). In use today: the landing
page's hero and rails, with the switch in the header of every page.

## Ownership

Platform front end.
