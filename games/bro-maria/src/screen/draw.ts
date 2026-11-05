import { banner } from "./banner.ts";
import { touchHints } from "./touch-hints.ts";
import { block, sprite } from "@frostbite/game-sdk/pixels";

import {
  groundRow,
  levelTiles,
  pixel,
  playerHeight,
  playerWidth,
  rows,
  slimeHeight,
  tile,
  urchinHeight,
} from "../rules/constants.ts";
import { solidAt } from "../rules/collide.ts";
import type { State } from "../rules/types.ts";
import { mountains, sky, snow } from "./backdrop.ts";
import { colour } from "./palette.ts";
import {
  coinFrames,
  coinKey,
  heroFrames,
  heroKey,
  slimeFrames,
  slimeKey,
  urchinKey,
  urchinRows,
} from "./sprites.ts";

// The screen is drawn small and scaled up by the page, crisp, like the platform's scenes: 256 by 144, sixteen tiles across and nine down. A
// subunit of the rules is a sixteenth of a pixel. Drawing reads the state and changes nothing in it.
export const screenWidth = 256;
export const screenHeight = 144;
const tilePixels = tile / pixel;

// How far the view has scrolled, in pixels: the hero is kept a little left of the middle, and the view stops at the ends of the level.
export const cameraOf = (state: State): number =>
  Math.min(
    Math.max(0, Math.round(state.hero.x / pixel) - 96),
    levelTiles * tilePixels - screenWidth,
  );

const toScreen = (units: number, camera: number): number =>
  Math.round(units / pixel) - camera;

function ground(
  context: CanvasRenderingContext2D,
  state: State,
  camera: number,
): void {
  const first = Math.floor(camera / tilePixels);
  const last = first + screenWidth / tilePixels + 1;
  for (let column = first; column <= last; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      if (!solidAt(state.level, column, row)) continue;
      const x = column * tilePixels - camera;
      const y = row * tilePixels;
      const floating = row < (state.level.ground[column] ?? rows);
      const lit = !solidAt(state.level, column, row - 1);
      block(
        context,
        floating ? colour.crateDark : colour.iceDark,
        x,
        y,
        tilePixels,
        tilePixels,
      );
      block(
        context,
        floating ? colour.wood : lit ? colour.ice : colour.iceDeep,
        x,
        y + 1,
        tilePixels - 1,
        tilePixels - 2,
      );
      if (lit && !floating) block(context, colour.snow, x, y, tilePixels, 2);
    }
  }
}

function crates(
  context: CanvasRenderingContext2D,
  state: State,
  camera: number,
): void {
  state.level.crates.forEach((crate, at) => {
    const used = state.cratesUsed[at] === true;
    const x = crate.x * tilePixels - camera;
    const y = crate.y * tilePixels;
    block(
      context,
      used ? colour.crateUsed : colour.crate,
      x + 1,
      y + 1,
      tilePixels - 2,
      tilePixels - 2,
    );
    block(context, colour.crateDark, x, y, tilePixels, 1);
    block(context, colour.crateDark, x, y + tilePixels - 1, tilePixels, 1);
    if (!used) block(context, colour.white, x + 6, y + 4, 4, 8);
  });
}

function coins(
  context: CanvasRenderingContext2D,
  state: State,
  camera: number,
): void {
  const frame = coinFrames[Math.floor(state.tick / 12) % 2];
  if (frame === undefined) return;
  state.level.coins.forEach((coin, at) => {
    if (state.coinsTaken[at] === true) return;
    const bob = Math.round(Math.sin((state.tick + at * 7) / 14) * 1.5);
    sprite(
      context,
      frame,
      coinKey,
      toScreen(coin.x, camera) + 1,
      Math.round(coin.y / pixel) + bob,
    );
  });
}

function lanterns(
  context: CanvasRenderingContext2D,
  state: State,
  camera: number,
): void {
  const { checkpointX, goalX } = state.level;
  const post = (x: number, lit: boolean, fill: string): void => {
    const at = toScreen(x, camera);
    const top = groundRow * tilePixels;
    block(context, colour.crateDark, at, top - 28, 2, 28);
    block(context, lit ? fill : colour.crateUsed, at - 3, top - 36, 8, 8);
    if (lit) block(context, colour.white, at - 1, top - 34, 4, 4);
  };
  post(checkpointX, state.checkpoint, colour.coin);
  post(goalX, true, colour.parka);
}

function creatures(
  context: CanvasRenderingContext2D,
  state: State,
  camera: number,
): void {
  const walking = slimeFrames[Math.floor(state.tick / 16) % 2];
  state.slimes.forEach((slime, at) => {
    const patrol = state.level.patrols[at];
    if (!slime.alive || patrol === undefined || walking === undefined) return;
    sprite(
      context,
      walking,
      slimeKey,
      toScreen(slime.x, camera),
      Math.round(patrol.y / pixel) + (slimeHeight / pixel - walking.length),
    );
  });
  for (const urchin of state.level.urchins)
    sprite(
      context,
      urchinRows,
      urchinKey,
      toScreen(urchin.x, camera),
      Math.round(urchin.y / pixel) + (urchinHeight / pixel - urchinRows.length),
    );
}

function hero(
  context: CanvasRenderingContext2D,
  state: State,
  camera: number,
): void {
  if (state.invulnerable > 0 && Math.floor(state.tick / 4) % 2 === 0) return;
  const { grounded, vx } = state.hero;
  const frames =
    heroFrames.run[Math.floor(state.tick / 6) % 2] ?? heroFrames.stand;
  const picture = !grounded
    ? heroFrames.jump
    : vx === 0
      ? heroFrames.stand
      : frames;
  const x = toScreen(state.hero.x, camera);
  const y = Math.round(state.hero.y / pixel);
  block(
    context,
    colour.shadow,
    x + 1,
    Math.round((groundRow * tile) / pixel) - 1,
    playerWidth / pixel - 2,
    1,
  );
  sprite(
    context,
    picture,
    heroKey,
    x,
    y + (playerHeight / pixel - picture.length),
  );
}

export function draw(context: CanvasRenderingContext2D, state: State): void {
  const camera = cameraOf(state);
  sky(context, screenWidth, screenHeight, state.stage);
  mountains(context, camera, screenWidth, state.stage);
  ground(context, state, camera);
  crates(context, state, camera);
  lanterns(context, state, camera);
  coins(context, state, camera);
  creatures(context, state, camera);
  hero(context, state, camera);
  snow(context, state.tick, screenWidth, screenHeight);
  banner(context, state, screenWidth);
  touchHints(context, state, screenWidth, screenHeight);
}
