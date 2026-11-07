import { block, sprite } from "@frostbite/game-sdk/pixels";

import type { Spot } from "../rules/grid.ts";
import {
  baseHeight,
  baseWidth,
  bubbleSpot,
  defu,
  hallRows,
  heartSpot,
  lairRow,
} from "../rules/woods/base-map.ts";
import { baseStep } from "../rules/woods/constants.ts";
import { laserPhase, waveAt } from "../rules/woods/lair.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { defuKey, defuRows, guardKey, guardRows } from "./defu.ts";
import { flatFutures } from "./frost-look.ts";
import { egg } from "./hills-things.ts";
import { flatSparky } from "./sparky-look.ts";
import { spriteScaled } from "./kit-sprites.ts";
import { colour } from "./palette.ts";
import {
  friendKey,
  glitchyBack,
  glitchyColours,
  glitchyFront,
  glitchySide,
} from "./sprites.ts";
import { drawTiles, tileSize } from "./woods-base-tiles.ts";
import { baseKitLook } from "./woods-base-kit.ts";

// The woods outside the maze seen from above, flat: the picture when the screen cannot show them in three dimensions, following Glitchy.
// Over the ground: the backpack's foods and a glitch blast, the forcefield bubble and the heart, DeFu on her platform, her guards and
// shadow dragons, the dragons freed from their cages following Glitchy in a line, an egg in flight, Glitchy (blinking after a bump,
// ringed while the forcefield lasts, twice as big while a pineapple lasts, drawn up over its shadow while it flies), frost vision's
// futures, and DeFu's laser and shockwave. The counts over it are in `woods-base-hud.ts`.
const width = 256;
const height = 144;
// How far up Glitchy (and the dragons following it) is drawn at each height: on the ground, flying low, soaring.
export const flightLift = [0, 5, 12] as const;

// Where Glitchy is now, in pixels of the whole map: partway along a step.
export function glitchyOnBase(base: Base, tick: number): Spot {
  if (base.step === null) return { x: base.x * tileSize, y: base.y * tileSize };
  const share = Math.min(1, (tick - base.step.start) / baseStep);
  const along = (from: number, to: number): number =>
    Math.round((from + (to - from) * share) * tileSize);
  return {
    x: along(base.step.from.x, base.x),
    y: along(base.step.from.y, base.y),
  };
}

const clamp = (value: number, most: number): number =>
  Math.min(Math.max(0, value), most);

// The top-left corner of the view: centred on a point of the map, but never past its edges.
export const cameraOn = (point: Spot): Spot => ({
  x: clamp(point.x + 8 - width / 2, baseWidth * tileSize - width),
  y: clamp(point.y + 8 - height / 2, baseHeight * tileSize - height),
});

export const baseCamera = (base: Base, tick: number): Spot =>
  cameraOn(glitchyOnBase(base, tick));

const shadowKey = {
  ...glitchyColours,
  b: "#5a3a8a",
  d: "#2a1840",
  e: colour.berry,
  h: colour.berry,
  l: "#3b2266",
  m: "#3b2266",
  w: "#5a3a8a",
};

function glitchyPicture(base: Base): readonly string[] {
  if (base.facing === "down") return glitchyFront;
  if (base.facing === "up") return glitchyBack;
  return base.facing === "right"
    ? glitchySide.stand
    : glitchySide.stand.map((row) => [...row].reverse().join(""));
}

// DeFu's laser (a thin line while it glows, a beam while it burns) and her shockwave (a square ring of tiles round her platform).
function weapons(
  context: CanvasRenderingContext2D,
  base: Base,
  tick: number,
  camera: Spot,
): void {
  const phase = laserPhase(base, tick);
  const { laser } = base;
  if (phase !== null && laser !== null) {
    const thick = phase === "burn" ? 6 : 1;
    const fill = phase === "burn" ? colour.fireHot : colour.berry;
    const middle = laser.line * tileSize + 8 - thick / 2;
    if (laser.horizontal)
      block(
        context,
        fill,
        tileSize - camera.x,
        middle - camera.y,
        (baseWidth - 2) * tileSize,
        thick,
      );
    else
      block(
        context,
        fill,
        middle - camera.x,
        tileSize - camera.y,
        thick,
        hallRows * tileSize,
      );
  }
  const wave = waveAt(base, tick);
  if (wave === null) return;
  const size = (wave * 2 + 1) * tileSize;
  const left = (defu.x - wave) * tileSize - camera.x;
  const top = (defu.y - wave) * tileSize - camera.y;
  const fill = wave === 0 ? colour.lavender : colour.pink;
  const bottom = Math.min(top + size, (hallRows + 1) * tileSize - camera.y);
  block(context, fill, left, top, size, 2);
  if (top + size === bottom) block(context, fill, left, bottom - 2, size, 2);
  block(context, fill, left, top, 2, bottom - top);
  block(context, fill, left + size - 2, top, 2, bottom - top);
}

function actors(
  context: CanvasRenderingContext2D,
  base: Base,
  tick: number,
  camera: Spot,
  scale: number,
): void {
  const at = (spot: Spot, dx = 0, dy = 0) =>
    [
      spot.x * tileSize + dx - camera.x,
      spot.y * tileSize + dy - camera.y,
    ] as const;
  if (!base.bubbleTaken)
    block(context, colour.cyan, ...at(bubbleSpot, 4, 4), 8, 8);
  if (!base.heartTaken)
    block(context, colour.berry, ...at(heartSpot, 4, 5), 8, 6);
  if (base.lairStart >= 0 || base.y <= lairRow + 6)
    sprite(
      context,
      defuRows,
      defuKey(laserPhase(base, tick) === "glow"),
      ...at(defu, 0, -12),
    );
  for (const guard of base.guards) {
    sprite(context, guardRows, guardKey, ...at(guard, 3, 1));
    if (guard.dizzy > 0) block(context, colour.gold, ...at(guard, 6, -3), 4, 2);
  }
  for (const shadow of base.shadows)
    sprite(context, glitchyFront, shadowKey, ...at(shadow));
  const lift = flightLift[base.altitude];
  let following = 0;
  base.allies.forEach((freed, ally) => {
    const spot = freed ? base.trail[following] : undefined;
    if (freed) following += 1;
    if (spot !== undefined)
      sprite(context, glitchyFront, friendKey(ally), ...at(spot, 0, -lift));
  });
  if (base.flight !== null) egg(context, ...at(base.flight, 4, 4), 0);
  const glitchy = glitchyOnBase(base, tick);
  const x = glitchy.x - camera.x;
  const y = glitchy.y - camera.y - lift;
  if (lift > 0) block(context, colour.shadow, x + 3, y + lift + 13, 10, 3);
  flatSparky(context, base, tick, camera, {
    x: glitchy.x,
    y: glitchy.y - lift,
  });
  if (base.invulnerable === 0 || Math.floor(tick / 4) % 2 === 1)
    spriteScaled(
      context,
      glitchyPicture(base),
      glitchyColours,
      x + 8 - 8 * scale,
      y + 16 - 16 * scale,
      scale,
    );
  if (base.forcefield > 0)
    for (let dot = 0; dot < 16; dot += 1) {
      const angle = (dot / 16) * Math.PI * 2 + tick / 30;
      block(
        context,
        colour.cyan,
        Math.round(x + 8 + Math.cos(angle) * 11),
        Math.round(y + 8 + Math.sin(angle) * 11),
        1,
        1,
      );
    }
}

export function drawBase(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  base: Base,
  camera: Spot = baseCamera(base, state.tick),
): void {
  drawTiles(context, base, camera, width, height);
  baseKitLook(context, base, state.tick, camera);
  flatFutures(context, state, camera);
  actors(context, base, state.tick, camera, state.powers.big ? 2 : 1);
  weapons(context, base, state.tick, camera);
}
