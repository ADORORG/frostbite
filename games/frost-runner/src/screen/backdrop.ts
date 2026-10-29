import { colour } from "./palette.ts";
import {
  block,
  groundY,
  px,
  screenHeight,
  screenWidth,
  wrap,
} from "./pixel.ts";

// Everything behind the runner, in layers that slide by at different speeds so the world has depth. It reads the distance and the tick
// and nothing else, so the same state always draws the same picture.
function sky(context: CanvasRenderingContext2D): void {
  block(context, colour.background, 0, 0, screenWidth, screenHeight);
  block(context, colour.night, 0, 24, screenWidth, 36);
  block(context, colour.deep, 0, 48, screenWidth, groundY - 48);
}

// Two soft bands of northern light that sway slowly.
function aurora(context: CanvasRenderingContext2D, tick: number): void {
  for (let x = 0; x < screenWidth; x += 2) {
    const wave = Math.sin(x / 23 + tick / 90) * 5;
    block(context, colour.aurora, x, 12 + wave, 2, 14);
    block(context, colour.auroraCool, x, 20 - wave, 2, 9);
  }
}

function stars(
  context: CanvasRenderingContext2D,
  distance: number,
  tick: number,
): void {
  for (let at = 0; at < 26; at += 1) {
    const bright = (tick + at * 7) % 40 < 4;
    block(
      context,
      bright ? colour.starBright : colour.star,
      wrap(at * 47 - px(distance) / 8, screenWidth),
      (at * 29) % 36,
      1,
      1,
    );
  }
}

function ridges(context: CanvasRenderingContext2D, distance: number): void {
  for (let x = 0; x < screenWidth; x += 2) {
    const far =
      groundY - 20 - Math.abs(Math.sin((x + px(distance) / 4) / 17) * 13);
    block(context, colour.ridge, x, far, 2, groundY - far);
    block(context, colour.cloud, x, far, 2, 1);
    const near =
      groundY - 8 - Math.abs(Math.sin((x + px(distance) / 1.7) / 11 + 2) * 9);
    block(context, colour.hill, x, near, 2, groundY - near);
    if (near < groundY - 12) block(context, colour.frost, x, near, 2, 1);
  }
}

// The ice the runner runs on: a bright line, and tiles of two shades going by at the speed of the world.
function ground(context: CanvasRenderingContext2D, distance: number): void {
  block(
    context,
    colour.ground,
    0,
    groundY,
    screenWidth,
    screenHeight - groundY,
  );
  for (let x = -16; x < screenWidth + 16; x += 16) {
    const at = x - wrap(px(distance), 16);
    block(context, colour.groundLight, at, groundY + 3, 8, 3);
    block(context, colour.groundLight, at + 8, groundY + 9, 8, 3);
  }
  block(context, colour.groundLine, 0, groundY, screenWidth, 1);
}

// Snow falling past, each flake at its own speed, and streaks along the ground when the world is fast.
export function snow(context: CanvasRenderingContext2D, tick: number): void {
  for (let at = 0; at < 30; at += 1) {
    const speed = (at % 3) + 1;
    block(
      context,
      at % 5 === 0 ? colour.core : colour.frost,
      wrap(
        at * 53 - tick * speed * 0.6 + Math.sin((tick + at * 9) / 25) * 3,
        screenWidth,
      ),
      wrap(at * 13 + tick * speed * 0.35, groundY),
      1,
      1,
    );
  }
}

export function speedLines(
  context: CanvasRenderingContext2D,
  tick: number,
  speed: number,
): void {
  if (speed <= 4) return;
  for (let at = 0; at < speed - 4; at += 1)
    block(
      context,
      colour.groundLight,
      wrap(at * 71 - tick * (speed + at), screenWidth),
      groundY - 12 - ((at * 17) % 40),
      8 + speed,
      1,
    );
}

export function backdrop(
  context: CanvasRenderingContext2D,
  distance: number,
  tick: number,
): void {
  sky(context);
  aurora(context, tick);
  stars(context, distance, tick);
  ridges(context, distance);
  ground(context, distance);
}
