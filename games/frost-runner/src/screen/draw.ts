import {
  icicleBottom,
  slidingHeight,
  spikeHeight,
  standingHeight,
} from "../rules/constants.ts";
import { metres } from "../rules/milestones.ts";
import { heightOf } from "../rules/physics.ts";
import type { RunnerState } from "../rules/types.ts";
import { shardHeight, speedAt } from "../rules/world.ts";
import { backdrop, snow, speedLines } from "./backdrop.ts";
import { colour } from "./palette.ts";
import {
  block,
  groundY,
  px,
  runnerX,
  screenHeight,
  screenWidth,
  sprite,
} from "./pixel.ts";
import {
  runnerFrames,
  runnerKeys,
  shardFrames,
  shardKey,
  spikeKey,
  spikeRows,
} from "./sprites.ts";

export { screenHeight, screenWidth } from "./pixel.ts";

// The screen is drawn small and scaled up by the page, crisp, like the platform's scenes: 160 by 90, a unit of the world is half a pixel,
// and the ground is a line near the bottom. Drawing reads the state and changes nothing in it.
function runner(context: CanvasRenderingContext2D, state: RunnerState): void {
  const { action } = state;
  const feet = groundY - px(heightOf(action));
  const keys = state.alive ? runnerKeys.alive : runnerKeys.dead;
  // A shadow on the ground, smaller the higher the runner is.
  block(
    context,
    colour.shadow,
    runnerX,
    groundY,
    Math.max(2, 6 - px(heightOf(action)) / 3),
    1,
  );
  if (action.kind === "slide")
    sprite(
      context,
      runnerFrames.slide,
      keys,
      runnerX,
      groundY - px(slidingHeight),
    );
  else if (action.kind === "jump")
    sprite(context, runnerFrames.jump, keys, runnerX, feet - 7);
  else
    sprite(
      context,
      runnerFrames.run[Math.floor(state.tick / 4) % 2] ?? runnerFrames.run[0],
      keys,
      runnerX,
      groundY - px(standingHeight),
    );
}

function spike(context: CanvasRenderingContext2D, x: number): void {
  sprite(context, spikeRows, spikeKey, x, groundY - px(spikeHeight));
}

// An icicle hangs from a ledge of cloud and tapers evenly to a point, lit along its left edge; its tip glints now and then.
function icicle(
  context: CanvasRenderingContext2D,
  x: number,
  tick: number,
): void {
  const bottom = groundY - px(icicleBottom);
  const length = bottom - 3;
  block(context, colour.cloud, x - 1, 0, 9, 3);
  for (let row = 3; row < bottom; row += 1) {
    const width = Math.max(1, Math.round(7 * (1 - (row - 3) / length)));
    const left = x + Math.floor((7 - width) / 2);
    block(context, colour.frost, left, row, width, 1);
    block(context, colour.core, left, row, 1, 1);
  }
  if (tick % 30 < 4) block(context, colour.core, x + 3, bottom - 1, 1, 1);
}

function shard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tick: number,
): void {
  const frame = shardFrames[Math.floor(tick / 6) % 2] ?? shardFrames[0];
  sprite(context, frame, shardKey, x, y);
}

// The score line is drawn by the page in text (it must be readable and selectable), so only the run's bar is here: how far along the best
// distance the run is.
function bar(
  context: CanvasRenderingContext2D,
  state: RunnerState,
  best: number,
): void {
  const length = Math.min(
    screenWidth - 4,
    Math.round((metres(state) / Math.max(best, 100)) * (screenWidth - 4)),
  );
  block(context, colour.deep, 2, 2, screenWidth - 4, 2);
  if (length > 0) block(context, colour.yellow, 2, 2, length, 2);
}

export function draw(
  context: CanvasRenderingContext2D,
  state: RunnerState,
  best: number,
): void {
  backdrop(context, state.distance, state.tick);
  speedLines(context, state.tick, speedAt(state.distance));
  for (const item of state.shards)
    shard(
      context,
      runnerX + px(item.x),
      groundY - px(shardHeight(item)) - 6,
      state.tick,
    );
  for (const obstacle of state.obstacles) {
    const x = runnerX + px(obstacle.x);
    if (obstacle.kind === "spike") spike(context, x);
    else icicle(context, x, state.tick);
  }
  runner(context, state);
  snow(context, state.tick);
  bar(context, state, best);
  // A run that has ended flashes the whole screen red.
  if (!state.alive)
    block(context, colour.flash, 0, 0, screenWidth, screenHeight);
}
