import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { stillTime, type Scene } from "@ador/scenes/engine";
import { createRaster, framePlan, videoFiles } from "@ador/scenes/video";

import { runEncoder } from "./encode.ts";
import { commandFor, encoders } from "./encoders.ts";

// Draws a scene's whole loop, one frame after another, as the bytes an encoder reads. A copy is taken of each frame because the picture
// is reused for the next.
function* loopFrames(scene: Scene): Generator<Uint8Array> {
  const frame = scene.make();
  const { clear, pixels, surface } = createRaster();
  for (const seconds of framePlan(frame.loopSeconds)) {
    clear();
    frame.draw(surface, seconds);
    yield pixels.slice();
  }
}

function* stillFrame(scene: Scene): Generator<Uint8Array> {
  const frame = scene.make();
  const { pixels, surface } = createRaster();
  frame.draw(surface, stillTime(frame.loopSeconds));
  yield pixels.slice();
}

// Renders one scene to the files the page asks for (`videoFiles`) in `directory`, and says which it wrote. The frames are the same ones
// the canvas would draw, so a video is the scene, not a likeness of it.
export async function renderScene(
  scene: Scene,
  directory: string,
): Promise<readonly string[]> {
  await mkdir(directory, { recursive: true });
  const names = videoFiles(scene.id);
  const jobs = encoders.map((encoder) => ({
    encoder,
    file: join(
      directory,
      names[encoder.extension === "png" ? "poster" : encoder.extension],
    ),
  }));
  await Promise.all(
    jobs.map(({ encoder, file }) =>
      runEncoder(
        commandFor(encoder, file),
        encoder.frames === "all" ? loopFrames(scene) : stillFrame(scene),
      ),
    ),
  );
  const written = jobs.map(({ file }) => file);
  return written;
}
