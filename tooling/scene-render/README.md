# `@repo/scene-render`

Renders the platform's scenes (`@ador/scenes`) to video files, for browsers that cannot draw them. Developer tooling: not shipped, and
nothing in the platform imports it.

## Public API

`pnpm scenes:render` writes, for every scene, into `apps/web/public/scenes/` (git-ignored, generated, never hand-edited):

- `<id>.webm` (VP9) and `<id>.mp4` (H.264): one seamless loop, 640 x 360, 30 frames a second, silent, tens of kilobytes.
- `<id>.png`: the still frame the page shows while animation is off or the video has not loaded.

Options go after `--`: `pnpm scenes:render -- --scene runner` renders one scene; `--out <directory>` is required by the underlying
command (the root script supplies it).

## How it works

- The frames are the scene's own: `framePlan` (from `@ador/scenes/video`) spreads a whole number of frames evenly over the loop, and
  `createRaster` is a surface that draws into memory, so nothing needs a browser. A video is the scene, not a likeness of it.
- Each output is one `ffmpeg` command (`src/encoders.ts`, as data), fed raw frames on its input (`src/encode.ts`). The 160 x 90 picture is
  enlarged four times with no smoothing so pixels stay square.
- A command that cannot start or that fails rejects with what it said; nothing is reported written unless every encoder succeeded.

## Requirements

`ffmpeg` with `libvpx-vp9` and `libx264` on the path. The tests run the real encoder and fail without it.

## Invariants

- Output names come from `videoFiles` (`@ador/scenes/video`), the same function the page uses to ask for them.
- Rendering is repeatable: a file from an earlier run is replaced.

## Test commands

`pnpm --filter @repo/scene-render test:unit`, `test:integration` (renders a scene with the real encoder and reads the files back with
`ffprobe`), `test:coverage`.

## Operational ownership

Platform front end. Run it when a scene is added or changed, and as a release step before the web app is built; the app works without
the files (a browser that needs them shows the still, or nothing).
