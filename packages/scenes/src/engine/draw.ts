import { palette } from "./palette.ts";
import type { Surface } from "./scene.ts";
import { sceneHeight, sceneWidth } from "./scene.ts";

// Whether any of a rectangle falls inside the scene. Anything outside is not drawn: a scene can scroll and wrap without caring.
const seen = (x: number, y: number, width: number, height: number): boolean =>
  x + width > 0 && x < sceneWidth && y + height > 0 && y < sceneHeight;

// A filled rectangle on the pixel grid: positions snap to whole pixels so scaled-up art stays crisp.
export function rect(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: string,
): void {
  if (!seen(x, y, width, height)) return;
  surface.fillStyle = colour;
  surface.fillRect(Math.round(x), Math.round(y), width, height);
}

// A picture drawn from rows of text: each `#` is one pixel. Small art costs a few lines and no file, and each unbroken run of pixels in a
// row is one rectangle, so a picture costs a few calls, not one for every pixel.
export function sprite(
  surface: Surface,
  rows: readonly string[],
  x: number,
  y: number,
  colour: string,
  flip = false,
): void {
  surface.fillStyle = colour;
  rows.forEach((row, line) => {
    const cells = flip ? [...row].reverse() : [...row];
    let start = -1;
    for (let column = 0; column <= cells.length; column += 1) {
      const filled = cells[column] === "#";
      if (filled && start < 0) start = column;
      if (!filled && start >= 0) {
        const length = column - start;
        if (seen(x + start, y + line, length, 1))
          surface.fillRect(
            Math.round(x + start),
            Math.round(y + line),
            length,
            1,
          );
        start = -1;
      }
    }
  });
}

// Smooth start and finish between 0 and 1; anything outside is held at the ends.
export function ease(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

// A repeatable run of numbers in [0, 1) from a seed, so a scene's random layout is the same on every visit and in every test.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4_294_967_296;
  };
}

// Dim stars over the top of a scene, placed from a seed.
export function stars(
  surface: Surface,
  seed: number,
  count: number,
  height: number,
): void {
  const random = seededRandom(seed);
  for (let at = 0; at < count; at += 1) {
    rect(
      surface,
      random() * sceneWidth,
      random() * Math.min(height, sceneHeight),
      1,
      1,
      at % 3 === 0 ? palette.starBright : palette.starDim,
    );
  }
}
