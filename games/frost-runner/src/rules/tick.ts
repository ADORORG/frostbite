import { closeCallClearance, maxTicks, spikeHeight } from "./constants.ts";
import {
  heightOf,
  hits,
  overlapsObstacle,
  progress,
  touches,
} from "./physics.ts";
import type { Obstacle, RunnerState } from "./types.ts";
import { speedAt, spawnAhead, widthOf } from "./world.ts";

// A spike passes under the runner's column: note how low the runner's feet were over it.
function noteClearance(obstacle: Obstacle, feet: number): Obstacle {
  if (obstacle.kind !== "spike" || !overlapsObstacle(obstacle)) return obstacle;
  const clearance = feet - spikeHeight;
  return {
    ...obstacle,
    lowestClearance:
      obstacle.lowestClearance === null
        ? clearance
        : Math.min(obstacle.lowestClearance, clearance),
  };
}

// One tick of a run: the world scrolls, the runner's jump or slide goes on, and what it meets is settled. An obstacle that is hit
// ends the run; one that has gone by is cleared (a close call when a spike was barely jumped).
export function tickOnce(state: RunnerState): RunnerState {
  if (!state.alive || state.ended) return state;
  const speed = speedAt(state.distance);
  const action = progress(state.action);
  const feet = heightOf(action);
  const moved = state.obstacles.map((obstacle) =>
    noteClearance({ ...obstacle, x: obstacle.x - speed }, feet),
  );
  const struck = moved.some((obstacle) => hits(obstacle, action));
  const shards = state.shards.map((shard) => ({
    ...shard,
    x: shard.x - speed,
  }));
  const taken = shards.filter((shard) => touches(shard, action));
  const gone = moved.filter((obstacle) => obstacle.x + widthOf(obstacle) <= 0);
  const next: RunnerState = {
    ...state,
    action,
    alive: !struck,
    cleared: state.cleared + (struck ? 0 : gone.length),
    closeCalls:
      state.closeCalls +
      (struck
        ? 0
        : gone.filter(
            (obstacle) =>
              obstacle.lowestClearance !== null &&
              obstacle.lowestClearance <= closeCallClearance,
          ).length),
    distance: state.distance + speed,
    highShards: state.highShards + taken.filter((shard) => shard.high).length,
    laidTo: state.laidTo - speed,
    obstacles: moved.filter((obstacle) => !gone.includes(obstacle)),
    shards: shards.filter((shard) => !taken.includes(shard) && shard.x + 3 > 0),
    shardsTaken: state.shardsTaken + taken.length,
    tick: state.tick + 1,
  };
  return struck ? next : spawnAhead(next);
}

// Lets the run go on to `tick` (it stops where it ends, or at the longest a run may be).
export function advanceTo(state: RunnerState, tick: number): RunnerState {
  let current = state;
  const until = Math.min(tick, maxTicks);
  while (current.alive && current.tick < until) current = tickOnce(current);
  return current;
}
