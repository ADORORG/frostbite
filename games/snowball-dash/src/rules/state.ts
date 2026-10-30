import { startState } from "@ador/game-sdk/seeded";

import { coyoteTicks, firstObstacleAt } from "./constants.ts";
import { layAhead } from "./spawn.ts";
import type { RunState } from "./types.ts";

// A run at its start: the snowball on the snow at the top of the slope, the first patterns laid, and nothing earned.
export function startRun(seed: number): RunState {
  return layAhead(
    {
      ahead: [],
      air: 0,
      alive: true,
      bestStreak: 0,
      buffer: 0,
      cause: null,
      choices: 0,
      cleared: { boulder: 0, pit: 0, rock: 0, spikes: 0 },
      closeCalls: 0,
      coyote: coyoteTicks,
      distance: 0,
      ended: false,
      generator: startState(seed),
      holding: false,
      hops: 0,
      longest: 0,
      lowest: null,
      nextAt: firstObstacleAt,
      peak: 0,
      pitEnd: null,
      score: 0,
      shards: [],
      shardsTaken: 0,
      streak: 0,
      tick: 0,
      vy: 0,
      y: 0,
    },
    0,
  );
}
