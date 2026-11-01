import { block, sprite } from "@ador/game-sdk/pixels";

import {
  eggGravity,
  fieldGround,
  launcherX,
  launcherY,
  powerHigh,
  powerLow,
} from "../rules/woods/constants.ts";
import { cosOf, sinOf, unit } from "../rules/woods/trig.ts";
import type { Launch, Target, WoodsState } from "../rules/woods/types.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// The launch round on the screen: a moonlit clearing outside the woods, the egg launcher at the left with a dotted guide of where an egg
// would go, the targets with their points, the egg in flight, and the score.
const field = (units: number): number => Math.round(units / 16);
const ground = field(fieldGround);
const eggRows = [".kk.", "kwwk", "kwpk", "kwwk", ".kk."];
const eggKey = { k: colour.ink, p: colour.pink, w: colour.belly };

function clearing(context: CanvasRenderingContext2D, tick: number): void {
  const sky = context.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, "#120a33");
  sky.addColorStop(1, "#4a3a8a");
  context.fillStyle = sky;
  context.fillRect(0, 0, 256, ground);
  for (let star = 0; star < 24; star += 1)
    if ((star + Math.floor(tick / 20)) % 5 !== 0)
      block(context, colour.white, (star * 41) % 256, (star * 17) % 70, 1, 1);
  block(context, colour.cream, 200, 12, 14, 14);
  block(context, "#2a1a5e", 204, 10, 12, 12);
  for (let tree = 0; tree < 5; tree += 1) {
    const x = tree * 9 - 4;
    for (let step = 0; step < 30; step += 3)
      block(
        context,
        "#1f5c3a",
        x + 4 - step / 6,
        ground - 30 + step,
        4 + step / 3,
        3,
      );
  }
  block(context, colour.grassDark, 0, ground, 256, 2);
  block(context, "#2f6a3c", 0, ground + 2, 256, 144 - ground);
}

function launcher(context: CanvasRenderingContext2D, launch: Launch): void {
  const x = field(launcherX);
  const y = field(launcherY);
  block(context, colour.woodDark, x - 9, y + 2, 18, 4);
  block(context, colour.stone, x - 7, y + 6, 4, 4);
  block(context, colour.stone, x + 3, y + 6, 4, 4);
  for (let along = 0; along < 14; along += 1)
    block(
      context,
      along > 10 ? colour.gold : colour.cyan,
      x + Math.round((cosOf(launch.aim) * along) / unit) - 1,
      y - Math.round((sinOf(launch.aim) * along) / unit) - 1,
      3,
      3,
    );
  // The guide: where an egg would be every few ticks, for the first part of its flight.
  const speed = (launch.power * 3) / 2;
  const vx = Math.trunc((cosOf(launch.aim) * speed) / unit);
  let vy = -Math.trunc((sinOf(launch.aim) * speed) / unit);
  let px = launcherX;
  let py = launcherY;
  for (let step = 1; step <= 24; step += 1) {
    px += vx;
    py += vy;
    vy += eggGravity;
    if (step % 4 === 0)
      block(context, colour.white, field(px), field(py), 1, 1);
  }
}

function target(
  context: CanvasRenderingContext2D,
  spot: Target,
  flash: boolean,
): void {
  const x = field(spot.x);
  const y = field(spot.y);
  const w = field(spot.width);
  const h = field(spot.height);
  if (spot.y + spot.height >= fieldGround - 1) {
    block(context, colour.woodDark, x, y + 2, w, h - 2);
    block(context, colour.wood, x + 1, y + 3, w - 2, h - 5);
    for (let weave = 2; weave < w - 2; weave += 3)
      block(context, colour.woodDark, x + weave, y + 4, 1, h - 6);
  } else if (spot.value >= 500) {
    block(context, colour.gold, x + w / 2 - 1, y, 2, h);
    block(context, colour.gold, x, y + h / 2 - 1, w, 2);
    block(context, colour.fireHot, x + 2, y + 2, w - 4, h - 4);
  } else {
    block(context, colour.pink, x, y, w, 2);
    block(context, colour.pink, x, y + h - 2, w, 2);
    block(context, colour.pink, x, y, 2, h);
    block(context, colour.pink, x + w - 2, y, 2, h);
  }
  write(
    context,
    String(spot.value),
    x + w / 2,
    y - 9,
    7,
    flash ? colour.gold : colour.white,
  );
}

export function drawLaunch(
  context: CanvasRenderingContext2D,
  state: WoodsState,
): void {
  clearing(context, state.tick);
  const { launch } = state;
  if (launch === null) {
    write(context, "OUT OF THE WOODS!", 128, 50, 14, colour.gold);
    return;
  }
  const recent =
    launch.last !== null && state.tick - launch.last.tick < 50
      ? launch.last
      : null;
  state.level.targets.forEach((spot, at) =>
    target(context, spot, recent?.target === at),
  );
  if (!launch.ended) launcher(context, launch);
  if (launch.flying !== null)
    sprite(
      context,
      eggRows,
      eggKey,
      field(launch.flying.x) - 2,
      field(launch.flying.y) - 2,
    );
  if (recent !== null) {
    const hit = state.level.targets[recent.target];
    if (hit !== undefined)
      write(
        context,
        `+${String(hit.value)}!`,
        field(hit.x + hit.width / 2),
        field(hit.y) - 20,
        10,
        colour.gold,
      );
  }
  write(context, `BONUS ${String(launch.score)}`, 4, 4, 9, colour.gold, "left");
  write(
    context,
    `EGGS LEFT ${String(launch.eggsLeft)}`,
    4,
    15,
    7,
    colour.white,
    "left",
  );
  block(context, colour.ink, 4, 25, 42, 4);
  block(
    context,
    colour.fire,
    5,
    26,
    Math.round((40 * (launch.power - powerLow)) / (powerHigh - powerLow)),
    2,
  );
  if (launch.ended)
    write(
      context,
      `BONUS ROUND OVER: ${String(launch.score)}!`,
      128,
      56,
      10,
      colour.gold,
    );
  else if (state.tick - launch.start < 300)
    write(
      context,
      "UP/DOWN: AIM  LEFT/RIGHT: POWER  F: LAUNCH",
      128,
      132,
      7,
      colour.white,
    );
}
