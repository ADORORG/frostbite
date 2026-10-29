import {
  icicleBottom,
  jumpPeak,
  jumpTicks,
  playerWidth,
  shardReach,
  slideTicks,
  slidingHeight,
  spikeHeight,
  standingHeight,
} from "./constants.ts";
import type { Action, Obstacle, Shard } from "./types.ts";
import { shardHeight, widthOf } from "./world.ts";

// How high the runner's feet are above the ground: a whole-number arc, up and down over `jumpTicks`, peaking at `jumpPeak`.
export function heightOf(action: Action): number {
  if (action.kind !== "jump") return 0;
  const t = action.tick;
  return Math.floor(
    (4 * jumpPeak * t * (jumpTicks - t)) / (jumpTicks * jumpTicks),
  );
}

export const lastsFor = (kind: "jump" | "slide"): number =>
  kind === "jump" ? jumpTicks : slideTicks;

// One tick further into an action, or back to running when it has run its course.
export function progress(action: Action): Action {
  if (action.kind === "none") return action;
  return action.tick + 1 >= lastsFor(action.kind)
    ? { kind: "none", tick: 0 }
    : { kind: action.kind, tick: action.tick + 1 };
}

// Whether something is over the runner's column.
export const overlaps = (x: number, width: number): boolean =>
  x < playerWidth && x + width > 0;

export const overlapsObstacle = (obstacle: Obstacle): boolean =>
  overlaps(obstacle.x, widthOf(obstacle));

// Whether the runner, doing `action`, hits an obstacle over its column: a spike takes the feet, an icicle takes a head that is not
// ducked under it (a runner in the air is too tall for one).
export function hits(obstacle: Obstacle, action: Action): boolean {
  if (!overlapsObstacle(obstacle)) return false;
  if (obstacle.kind === "spike") return heightOf(action) < spikeHeight;
  return heightOf(action) + headHeight(action) > icicleBottom;
}

export const headHeight = (action: Action): number =>
  action.kind === "slide" ? slidingHeight : standingHeight;

// Whether the runner picks a shard up: it is in the column and the runner's feet are within reach of it.
export const touches = (shard: Shard, action: Action): boolean =>
  overlaps(shard.x, 3) &&
  Math.abs(heightOf(action) - shardHeight(shard)) <= shardReach;
