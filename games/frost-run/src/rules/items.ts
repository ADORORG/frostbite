import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import { perRound, reach } from "./constants.ts";
import {
  cageRing,
  cageSpike,
  crateRadius,
  levelAt,
  solidShare,
  type Level,
  type Point,
} from "./levels.ts";
import type { Item, ItemKind } from "./types.ts";

// Where a round's crystals, eggs and keys go. The places come from the run's seed and the round alone, so a seed always lays out the
// same three rounds however the earlier ones were played.
export const roundSeed = (seed: number, round: number): number =>
  (seed ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0;

interface Placer {
  rng: number;
  readonly taken: Point[];
}

const near = (
  taken: readonly Point[],
  x: number,
  y: number,
  gap: number,
): boolean =>
  taken.some(
    ([tx, ty]) => (tx - x) * (tx - x) + (ty - y) * (ty - y) < gap * gap,
  );

const clearOfLevel = (
  level: Level,
  x: number,
  y: number,
  margin: number,
): boolean => {
  for (const [sx, sy, sr] of level.solids) {
    const r = Math.trunc((sr * solidShare.part) / solidShare.whole) + margin;
    if ((sx - x) * (sx - x) + (sy - y) * (sy - y) < r * r) return false;
  }
  for (const [cx, cy] of level.cages) {
    const r = 1350 + cageSpike + margin;
    if ((cx - x) * (cx - x) + (cy - y) * (cy - y) < r * r) return false;
  }
  for (const [cx, cy] of level.crates) {
    const r = crateRadius + margin;
    if ((cx - x) * (cx - x) + (cy - y) * (cy - y) < r * r) return false;
  }
  return true;
};

// A whole number from `low` to `high`, both included.
const draw = (placer: Placer, low: number, high: number): number => {
  const step = stepInt(placer.rng, high - low + 1);
  placer.rng = step.state;
  return low + step.value;
};

// A spot in the ring from `inner` to `outer` around (cx, cy), clear of the level and at least `gap` from every spot already taken. The
// gap shrinks if the floor is crowded, so a spot is always found.
const spot = (
  placer: Placer,
  level: Level,
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  gap: number,
): Point => {
  for (let tries = 0; tries < 400; tries += 1) {
    const spread = tries < 300 ? gap : Math.trunc(gap / 2);
    const x = cx + draw(placer, -outer, outer);
    const y = cy + draw(placer, -outer, outer);
    const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d2 < inner * inner || d2 > outer * outer) continue;
    if (!clearOfLevel(level, x, y, 800)) continue;
    if (near(placer.taken, x, y, spread)) continue;
    placer.taken.push([x, y]);
    return [x, y];
  }
  const fallback: Point = [cx, cy + inner];
  placer.taken.push(fallback);
  return fallback;
};

interface Spec {
  readonly kind: ItemKind;
  readonly at: Point;
  readonly z: number;
  readonly ghost?: boolean;
  readonly crate?: number;
  readonly cage?: number;
}

const floeItems = (placer: Placer, level: Level): Spec[] => {
  const specs: Spec[] = [];
  for (let i = 0; i < perRound.egg; i += 1)
    specs.push({
      at: spot(placer, level, 0, 0, 6000, 8000, 2300),
      kind: "egg",
      z: 0,
    });
  for (let i = 0; i < perRound.key; i += 1)
    specs.push({
      at: spot(placer, level, 0, 0, 2500, 7000, 2300),
      kind: "key",
      z: 1900,
    });
  for (let i = 0; i < perRound.crystal; i += 1) {
    specs.push({
      at: spot(placer, level, 0, 0, 1800, 7600, 2300),
      kind: "crystal",
      z: 350,
    });
  }
  return specs;
};

const soundItems = (placer: Placer, level: Level): Spec[] => {
  const specs: Spec[] = [];
  level.crates.forEach((at, crate) =>
    specs.push({ at, crate, kind: "egg", z: 0 }),
  );
  for (const at of level.crates) placer.taken.push(at);
  const islets = level.land.slice(1);
  for (let i = 0; i < perRound.key; i += 1) {
    const islet = islets[i];
    if (islet === undefined) break;
    specs.push({
      at: spot(placer, level, islet[0], islet[1], 0, islet[2] - 900, 1100),
      kind: "key",
      z: 600,
    });
  }
  const main = level.land[0];
  for (let i = 0; i < perRound.crystal; i += 1) {
    const islet =
      i % 2 === 1 ? islets[draw(placer, 0, islets.length - 1)] : undefined;
    const at =
      islet === undefined
        ? spot(placer, level, main?.[0] ?? 0, main?.[1] ?? 0, 1500, 4800, 1900)
        : spot(placer, level, islet[0], islet[1], 0, islet[2] - 800, 1200);
    specs.push({ at, kind: "crystal", z: 350 });
  }
  return specs;
};

const crownItems = (placer: Placer, level: Level): Spec[] => {
  const specs: Spec[] = [];
  level.cages.forEach((at, cage) =>
    specs.push({ at, cage, kind: "egg", z: 0 }),
  );
  for (let i = 0; i < perRound.key; i += 1) {
    specs.push({
      at: spot(placer, level, 0, 0, 2500, 8000, 2300),
      ghost: true,
      kind: "key",
      z: 600,
    });
  }
  for (let i = 0; i < perRound.crystal; i += 1) {
    specs.push({
      at: spot(placer, level, 0, 0, 1800, 8200, 2300),
      kind: "crystal",
      z: 350,
    });
  }
  return specs;
};

export const placeItems = (
  seed: number,
  round: number,
  firstId: number,
): Item[] => {
  const level = levelAt(round);
  const placer: Placer = {
    rng: startState(roundSeed(seed, round)),
    taken: [level.start],
  };
  const specs =
    level.id === "floe"
      ? floeItems(placer, level)
      : level.id === "sound"
        ? soundItems(placer, level)
        : crownItems(placer, level);
  return specs.map((spec, index) => ({
    cage: spec.cage ?? -1,
    crate: spec.crate ?? -1,
    ghost: spec.ghost ?? false,
    id: firstId + index,
    kind: spec.kind,
    takenAt: -1,
    x: spec.at[0],
    y: spec.at[1],
    z: spec.z,
  }));
};

export const reachOf = (kind: ItemKind): number => reach[kind];
export const ringOf = (centre: Point): Point[] =>
  cageRing.map(([dx, dy]) => [centre[0] + dx, centre[1] + dy]);
