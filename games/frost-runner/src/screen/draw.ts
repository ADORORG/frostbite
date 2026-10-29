import {
  icicleBottom,
  spikeHeight,
  standingHeight,
  slidingHeight,
} from "../rules/constants.ts";
import { metres } from "../rules/milestones.ts";
import { heightOf } from "../rules/physics.ts";
import type { RunnerState } from "../rules/types.ts";
import { shardHeight } from "../rules/world.ts";
import { colour } from "./palette.ts";

// The screen is drawn small and scaled up by the page, crisp, like the platform's scenes: 160 by 90, a unit of the world is half a
// pixel, and the ground is a line near the bottom. Drawing reads the state and changes nothing in it.
export const screenWidth = 160;
export const screenHeight = 90;
const groundY = 72;
const runnerX = 20;
const scale = 0.5;

const px = (units: number): number => Math.round(units * scale);

function block(
  context: CanvasRenderingContext2D,
  fill: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillStyle = fill;
  context.fillRect(Math.round(x), Math.round(y), width, height);
}

// A row of stars and a far ridge that slide by slower than the ground, so the world has depth.
function backdrop(context: CanvasRenderingContext2D, distance: number): void {
  block(context, colour.background, 0, 0, screenWidth, screenHeight);
  block(context, colour.night, 0, 24, screenWidth, 36);
  block(context, colour.deep, 0, 48, screenWidth, groundY - 48);
  for (let at = 0; at < 22; at += 1)
    block(
      context,
      colour.star,
      ((at * 47 - px(distance) / 6) % screenWidth) +
        (at * 47 - px(distance) / 6 < 0 ? screenWidth : 0),
      (at * 29) % 40,
      1,
      1,
    );
  for (let x = 0; x < screenWidth; x += 2) {
    const shifted = x + px(distance) / 3;
    const top = groundY - 14 - Math.abs(Math.sin(shifted / 17) * 12);
    block(context, colour.ridge, x, top, 2, groundY - top);
    block(context, colour.cloud, x, top, 2, 1);
  }
  block(
    context,
    colour.ground,
    0,
    groundY,
    screenWidth,
    screenHeight - groundY,
  );
  block(context, colour.groundLine, 0, groundY, screenWidth, 1);
}

function runner(context: CanvasRenderingContext2D, state: RunnerState): void {
  const sliding = state.action.kind === "slide";
  const height = px(sliding ? slidingHeight : standingHeight);
  const top = groundY - px(heightOf(state.action)) - height;
  const body = state.alive ? colour.cyan : colour.red;
  block(context, body, runnerX, top, 6, height);
  block(context, colour.core, runnerX + 3, top + 1, 2, 2);
}

function spike(context: CanvasRenderingContext2D, x: number): void {
  const base = px(spikeHeight);
  for (let row = 0; row < base; row += 1)
    block(
      context,
      colour.pink,
      x + Math.floor(row / 2),
      groundY - base + row,
      6 - Math.floor(row / 2) * 2,
      1,
    );
}

function icicle(context: CanvasRenderingContext2D, x: number): void {
  const bottom = groundY - px(icicleBottom);
  block(context, colour.cloud, x - 1, 0, 9, 3);
  for (let row = 3; row < bottom; row += 1)
    block(
      context,
      colour.core,
      x + Math.floor((row - 3) / 4),
      row,
      Math.max(1, 7 - Math.floor((row - 3) / 2)),
      1,
    );
}

export function draw(
  context: CanvasRenderingContext2D,
  state: RunnerState,
  best: number,
): void {
  backdrop(context, state.distance);
  for (const shard of state.shards) {
    const x = runnerX + px(shard.x);
    const y = groundY - px(shardHeight(shard)) - 6;
    block(context, colour.yellow, x, y, 3, 3);
    block(context, colour.core, x + 1, y + 1, 1, 1);
  }
  for (const obstacle of state.obstacles) {
    const x = runnerX + px(obstacle.x);
    if (obstacle.kind === "spike") spike(context, x);
    else icicle(context, x);
  }
  runner(context, state);
  hud(context, state, best);
}

// The score line is drawn by the page in text (it must be readable and selectable), so only the canvas's own tally is here.
function hud(
  context: CanvasRenderingContext2D,
  state: RunnerState,
  best: number,
): void {
  const bar = Math.min(
    screenWidth - 4,
    Math.round((metres(state) / Math.max(best, 100)) * (screenWidth - 4)),
  );
  block(context, colour.deep, 2, 2, screenWidth - 4, 2);
  if (bar > 0) block(context, colour.yellow, 2, 2, bar, 2);
}
