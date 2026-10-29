import { colour } from "./palette.ts";
import { block, groundY, screenHeight, screenWidth, wrap } from "./layout.ts";

// The sky behind the tower: a night that gets deeper the higher the tower climbs, a swaying aurora, twinkling stars that drift down as the
// view rises, a far ridge, and snow. Everything is a function of the tick and the camera, so a frame is the same whenever it is drawn.
const starCount = 36;

function sky(context: CanvasRenderingContext2D): void {
  const gradient = context.createLinearGradient(0, 0, 0, groundY);
  gradient.addColorStop(0, colour.background);
  gradient.addColorStop(0.6, colour.night);
  gradient.addColorStop(1, colour.skyLow);
  context.fillStyle = gradient;
  context.fillRect(0, 0, screenWidth, screenHeight);
}

function stars(
  context: CanvasRenderingContext2D,
  clock: number,
  camera: number,
): void {
  for (let at = 0; at < starCount; at += 1) {
    const x = (at * 37) % screenWidth;
    const y = wrap(((at * 53) % groundY) + camera * 0.25, groundY);
    const twinkle = (clock + at * 11) % 90 < 45;
    block(
      context,
      at % 5 === 0 && twinkle ? colour.starBright : colour.star,
      x,
      y,
      1,
      1,
    );
  }
}

function aurora(context: CanvasRenderingContext2D, clock: number): void {
  for (let column = 0; column < screenWidth; column += 4) {
    const sway = Math.sin(column / 22 + clock / 70) * 6;
    block(context, colour.aurora, column, 14 + sway, 4, 14);
    block(context, colour.auroraCool, column, 22 + sway * 0.6, 4, 10);
  }
}

function ridge(context: CanvasRenderingContext2D, camera: number): void {
  const base = groundY + camera * 0.5;
  for (let column = 0; column < screenWidth; column += 2) {
    const top = base - 18 - Math.abs(Math.sin(column / 17)) * 16;
    block(context, colour.ridge, column, top, 2, groundY - top + 40);
  }
}

function snow(context: CanvasRenderingContext2D, clock: number): void {
  for (let flake = 0; flake < 26; flake += 1) {
    const x = wrap(
      flake * 41 + Math.sin((clock + flake * 9) / 40) * 4,
      screenWidth,
    );
    const y = wrap(
      clock * (0.4 + (flake % 3) * 0.2) + flake * 29,
      screenHeight,
    );
    block(context, flake % 4 === 0 ? colour.core : colour.frost, x, y, 1, 1);
  }
}

export function drawBackdrop(
  context: CanvasRenderingContext2D,
  clock: number,
  camera: number,
): void {
  sky(context);
  stars(context, clock, camera);
  aurora(context, clock);
  ridge(context, camera);
  snow(context, clock);
}

// The ground the first block stands on, with its snowy edge; it leaves the screen as the view rises.
export function drawGround(
  context: CanvasRenderingContext2D,
  camera: number,
): void {
  const top = groundY + camera;
  if (top >= screenHeight) return;
  block(context, colour.ground, 0, top, screenWidth, screenHeight - top);
  for (let column = 0; column < screenWidth; column += 16)
    block(context, colour.groundLight, column, top + 4, 8, 3);
  block(context, colour.groundLine, 0, top, screenWidth, 1);
}
