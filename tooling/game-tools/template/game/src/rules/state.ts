import { startState as seedState, stepInt } from "@frostbite/game-sdk/seeded";

import {
  catchesPerSpeedStep,
  laneWidth,
  startSpeed,
  topSpeed,
  zoneHalfWidth,
} from "./constants.ts";
import type { StarterState } from "./types.ts";

// A zone is always wholly inside the lane, so every zone can be caught.
const room = laneWidth - 2 * zoneHalfWidth;

function nextZone(rng: number): {
  readonly rng: number;
  readonly zone: number;
} {
  const step = stepInt(rng, room + 1);
  return { rng: step.state, zone: zoneHalfWidth + step.value };
}

export const speedFor = (score: number): number =>
  Math.min(topSpeed, startSpeed + Math.floor(score / catchesPerSpeedStep));

export function startRun(seed: number): StarterState {
  const { rng, zone } = nextZone(seedState(seed));
  return {
    cause: null,
    direction: 1,
    ended: false,
    lastTap: -1,
    position: 0,
    rng,
    score: 0,
    speed: startSpeed,
    tick: 0,
    zone,
  };
}

// Where the marker is on `tick`, which is not before the one the state is on: it moves `speed` units a tick and turns round at either end.
export function advance(state: StarterState, tick: number): StarterState {
  let { direction, position } = state;
  for (let at = state.tick; at < tick; at += 1) {
    position += direction * state.speed;
    if (position >= laneWidth) {
      position = 2 * laneWidth - position;
      direction = -1;
    } else if (position <= 0) {
      position = -position;
      direction = 1;
    }
  }
  return { ...state, direction, position, tick };
}

// A tap on `tick`: a catch if the marker is in the zone, and the end of the run if it is not.
export function catchAt(state: StarterState, tick: number): StarterState {
  const moved = advance(state, tick);
  if (Math.abs(moved.position - moved.zone) > zoneHalfWidth)
    return { ...moved, cause: "missed", ended: true, lastTap: tick };
  const score = moved.score + 1;
  return {
    ...moved,
    ...nextZone(moved.rng),
    lastTap: tick,
    score,
    speed: speedFor(score),
  };
}
