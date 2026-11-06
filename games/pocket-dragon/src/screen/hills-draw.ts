import { block, wrap } from "@frostbite/game-sdk/pixels";
import { byInput } from "@frostbite/game-sdk/touch";

import {
  arenaX,
  bannerTicks,
  groundRow,
  heroWidth,
  pixel,
  rows,
  stages,
  tile,
} from "../rules/hills/constants.ts";
import { solidAt } from "../rules/hills/collide.ts";
import { sectionOf, sectionSpan } from "../rules/hills/secrets.ts";
import type { HillsState } from "../rules/hills/types.ts";
import {
  berry,
  cheerPuff,
  egg,
  fireball,
  gloomling,
  goldenEgg,
  iceBlock,
  nest,
  portal,
  thorn,
} from "./hills-things.ts";
import { colour, hillSkies } from "./palette.ts";
import { drawArena } from "./hills-boss.ts";
import {
  heroGear,
  powerBars,
  secretBackdrop,
  secretThings,
  secretTile,
} from "./hills-secrets.ts";
import { hillsHero, kitThings } from "./hills-kit.ts";
import { hillsHud, plasma, secretCharm, weather } from "./hills-sky.ts";
import { drawPack } from "./pack-hud.ts";
import { write } from "./text.ts";

// Egg Hills on a screen 256 by 144 pixels: sixteen tiles across, nine down, scrolling with Glitchy. It reads the state and changes nothing.
export const width = 256;
export const height = 144;
const tilePixels = tile / pixel;
const stageNames = [
  "WINDY MEADOW",
  "RAINY BUTTERCUP HILLS",
  "FOGGY SUNSET RIDGE",
] as const;

// The camera follows Glitchy within the stretch of world Glitchy is in (the stage, the tunnel or the sky), and once the boss fight
// begins it glides (over half a second) to the arena and stays there.
export function hillsCamera(state: HillsState): number {
  const [first, last] = sectionSpan(sectionOf(state.hero.x));
  const follow = Math.min(
    Math.max(first * tilePixels, Math.round(state.hero.x / pixel) - 96),
    last * tilePixels - width,
  );
  const { started } = state.boss;
  if (started < 0 || state.hero.x + heroWidth < arenaX - 2 * tile)
    return follow;
  const lock = arenaX / pixel;
  const glide = Math.min(30, state.tick - started);
  return follow + Math.round(((lock - follow) * glide) / 30);
}

const px = (units: number): number => Math.round(units / pixel);

function backdrop(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const section = sectionOf(state.hero.x);
  if (section !== "main") {
    secretBackdrop(context, section, camera, state.tick);
    return;
  }
  const [high, low, far] = hillSkies[state.stage - 1] ??
    hillSkies[0] ?? ["#6ec6ff", "#c9f1ff", "#8ed88a"];
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, high);
  sky.addColorStop(0.7, low);
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  block(context, state.stage === 3 ? "#ffb35e" : "#fff6b0", 200, 18, 18, 18);
  for (let puff = 0; puff < 5; puff += 1) {
    const x =
      wrap(puff * 70 - camera * 0.1 - state.tick * 0.05, width + 40) - 20;
    block(context, colour.white, x, 14 + (puff % 3) * 9, 22, 5);
    block(context, colour.white, x + 5, 11 + (puff % 3) * 9, 12, 3);
  }
  for (let x = 0; x < width; x += 1) {
    const roll =
      Math.sin((x + camera * 0.25) / 23) * 9 +
      Math.sin((x + camera * 0.25) / 9) * 3;
    block(context, far, x, 82 + Math.round(roll), 1, 70);
  }
}

function ground(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const first = Math.floor(camera / tilePixels);
  for (
    let column = first;
    column <= first + width / tilePixels + 1;
    column += 1
  )
    for (let row = 0; row < rows; row += 1) {
      const key = column * 64 + row;
      const x = column * tilePixels - camera;
      const y = row * tilePixels;
      const iceAt = state.level.iceAt.get(key);
      if (iceAt !== undefined) {
        if (state.melted[iceAt] !== true) iceBlock(context, x, y);
        continue;
      }
      if (!solidAt(state.level, state.melted, column, row)) continue;
      const top = !solidAt(state.level, state.melted, column, row - 1);
      const section = sectionOf(column * tile);
      if (section !== "main") {
        secretTile(context, section, x, y, top);
        continue;
      }
      const floating = state.level.solid.has(key);
      block(
        context,
        floating ? colour.woodDark : colour.dirtDark,
        x,
        y,
        tilePixels,
        tilePixels,
      );
      block(
        context,
        floating ? colour.wood : colour.dirt,
        x,
        y + 1,
        tilePixels - 1,
        tilePixels - 2,
      );
      if ((column * 7 + row * 3) % 5 === 0)
        block(context, colour.dirtDark, x + 5, y + 8, 2, 2);
      if (top) {
        block(context, colour.grass, x, y, tilePixels, 4);
        block(context, colour.grassDark, x, y + 4, tilePixels, 1);
        if (column % 3 === 0) block(context, colour.grass, x + 4, y - 2, 1, 2);
      }
    }
}

function things(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { level } = state;
  const groundY = groundRow * tilePixels;
  nest(context, px(level.checkpointX) - camera, groundY, state.checkpoint);
  portal(context, px(level.goalX) - camera + 8, groundY, state.tick);
  level.eggs.forEach((spot, at) => {
    if (state.eggsTaken[at] !== true)
      egg(
        context,
        px(spot.x) - camera,
        px(spot.y) + (Math.floor((state.tick + at * 5) / 15) % 2),
        at,
      );
  });
  if (!state.goldenTaken)
    goldenEgg(
      context,
      px(level.golden.x) - camera,
      px(level.golden.y),
      state.tick,
    );
  if (!state.berryTaken)
    berry(context, px(level.berry.x) - camera, px(level.berry.y), state.tick);
  level.thorns.forEach((spot, at) => {
    if (state.thornsGone[at] !== true)
      thorn(context, px(spot.x) - camera, px(spot.y));
  });
  state.glooms.forEach((gloom, at) => {
    const patrol = level.patrols[at];
    if (patrol === undefined) return;
    if (gloom.alive)
      gloomling(context, px(gloom.x) - camera, px(patrol.y), state.tick, at);
    else if (state.tick - gloom.cheered < 60)
      cheerPuff(
        context,
        px(gloom.x) - camera,
        px(patrol.y),
        state.tick - gloom.cheered,
      );
  });
  for (const ball of state.fireballs)
    fireball(context, px(ball.x) - camera, px(ball.y), state.tick);
}

function banner(context: CanvasRenderingContext2D, state: HillsState): void {
  write(
    context,
    `STAGE ${String(state.stage)}/${String(stages)}`,
    4,
    4,
    8,
    colour.white,
    "left",
  );
  if (state.hasFire && state.boss.started < 0)
    write(
      context,
      byInput("FIRE: F OR X", "FIRE: RIGHT THUMB"),
      width - 4,
      4,
      7,
      colour.fireHot,
      "right",
    );
  const since = state.tick - state.stageStart;
  if (since < bannerTicks) {
    write(
      context,
      `STAGE ${String(state.stage)}`,
      width / 2,
      36,
      18,
      colour.gold,
    );
    write(
      context,
      stageNames[state.stage - 1] ?? "",
      width / 2,
      58,
      9,
      colour.white,
    );
  }
  // Cleared, the level says so while the quest shifts to the next one; a lost run is told by the card over the screen once it is over.
  if (state.finishTick !== null)
    write(context, "EGG HILLS CLEARED!", width / 2, 50, 14, colour.gold);
}

export function drawHills(
  context: CanvasRenderingContext2D,
  state: HillsState,
): void {
  const camera = hillsCamera(state);
  backdrop(context, state, camera);
  ground(context, state, camera);
  things(context, state, camera);
  secretThings(context, state, camera);
  plasma(context, state, camera);
  secretCharm(context, state, camera);
  drawArena(context, state, camera);
  kitThings(context, state, camera);
  hillsHero(context, state, camera);
  heroGear(context, state, camera);
  if (sectionOf(state.hero.x) === "main") weather(context, state, camera);
  banner(context, state);
  hillsHud(context, state);
  powerBars(context, state);
  drawPack(context, state.powers, state.tick);
}
