import { Vector3 } from "three";

import { heroIds } from "../rules/constants.ts";
import { type Point, zoneAt } from "../rules/geometry.ts";
import { greyAt, greyHomes } from "../rules/greys.ts";
import { familySpots, places } from "../rules/layout.ts";
import type { PlayState } from "../rules/types.ts";

// Where the story goes next, as Savage Vision shows it and Sparky leans toward it: the tree until it is touched, the lamp until Sparky is
// forged, then whoever of the family is still lost, a thread lying where a grey one was healed, the nearest grey one still unhealed, the
// loom once all six threads are in, and at the last the hill. And the way there through the house's doorways, never through a wall.
const near = (from: Point, options: readonly Point[]): Point | null => {
  let best: Point | null = null;
  let bestFar = Number.POSITIVE_INFINITY;
  for (const option of options) {
    const far = (option.x - from.x) ** 2 + (option.z - from.z) ** 2;
    if (far < bestFar) {
      best = option;
      bestFar = far;
    }
  }
  return best;
};

export function goalOf(state: PlayState): Point | null {
  if (state.lead === null || state.ended) return null;
  if (!state.touchedTree) return places.tree;
  if (!state.sparky) return places.lamp;
  const lost = heroIds.filter(
    (hero) => hero !== state.lead && !state.party.includes(hero),
  );
  const family = near(
    state,
    lost.map((hero) => familySpots[hero]),
  );
  if (family !== null) return family;
  const threads = state.greys
    .filter((grey) => grey.thread === 1)
    .map((grey) => ({ x: grey.dropX, z: grey.dropZ }));
  const thread = near(state, threads);
  if (thread !== null) return thread;
  const greys = state.greys.flatMap((grey, index) => {
    const home = greyHomes[index];
    return grey.healed || home === undefined
      ? []
      : [greyAt(home, grey.spot, grey.phase, state.tick)];
  });
  const grey = near(state, greys);
  if (grey !== null) return grey;
  if (!state.jackets) return places.loom;
  return places.hill;
}

// The doorway between a room and the hall (or, for the meadow, the front door), as a point either side of it.
const doorways: Readonly<Record<string, readonly [Point, Point]>> = {
  kids: [
    { x: -3_700, z: 10_300 },
    { x: -2_300, z: 10_300 },
  ],
  kitchen: [
    { x: -3_700, z: 3_100 },
    { x: -2_300, z: 3_100 },
  ],
  meadow: [
    { x: 0, z: -900 },
    { x: 0, z: 700 },
  ],
  office: [
    { x: 3_700, z: 3_100 },
    { x: 2_300, z: 3_100 },
  ],
  parents: [
    { x: 3_700, z: 10_300 },
    { x: 2_300, z: 10_300 },
  ],
};

// The way from one point to another, in metres a little above the floor: out of the first room by its doorway, across the hall, in by the
// other room's doorway.
export function routeOf(from: Point, to: Point, height = 0.15): Vector3[] {
  const start = zoneAt(from);
  const end = zoneAt(to);
  const points: Point[] = [from];
  if (start !== end) {
    const out = doorways[start];
    if (out !== undefined) points.push(out[0], out[1]);
    const into = doorways[end];
    if (into !== undefined) points.push(into[1], into[0]);
  }
  points.push(to);
  return points.map(
    (point) => new Vector3(point.x / 1000, height, point.z / 1000),
  );
}
