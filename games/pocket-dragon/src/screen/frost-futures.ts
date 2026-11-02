import type { Facing, Spot } from "../rules/grid.ts";
import { baseKit } from "../rules/woods/base-map.ts";
import { tickWoods } from "../rules/woods/tick.ts";
import type { WoodsControl, WoodsState } from "../rules/woods/types.ts";
import { visionOn } from "../rules/woods/vision.ts";

// Frost vision's three possible outcomes. From where Glitchy is, the rules themselves play the next few seconds three ways: keep on the
// way Glitchy faces, or turn to either side and keep on. Each way is the tiles Glitchy would cross and how it would end: a bump (`hurt`),
// something good reached (`find`: the heart, the forcefield, a food, the lair's gate), or neither (`safe`). It is only worked out while
// the vision lasts, and once for each state of the run.
export type Outcome = "find" | "hurt" | "safe";
export interface Future {
  readonly end: Outcome;
  readonly path: readonly Spot[];
  readonly way: Facing;
}
export const futureTicks = 96;

const sides: Readonly<Record<Facing, readonly [Facing, Facing]>> = {
  down: ["right", "left"],
  left: ["down", "up"],
  right: ["up", "down"],
  up: ["left", "right"],
};

const letGo = (state: WoodsState): Readonly<Record<WoodsControl, boolean>> =>
  Object.fromEntries(
    Object.keys(state.controls).map((name) => [name, false]),
  ) as Readonly<Record<WoodsControl, boolean>>;

const kitCount = (state: WoodsState): number =>
  state.base?.kitTaken.filter(Boolean).length ?? 0;

function found(before: WoodsState, after: WoodsState): boolean {
  const was = before.base;
  const now = after.base;
  if (was === null || now === null) return false;
  return (
    (now.heartTaken && !was.heartTaken) ||
    (now.bubbleTaken && !was.bubbleTaken) ||
    kitCount(after) > kitCount(before) ||
    after.scene?.id === "lair"
  );
}

function playOut(state: WoodsState, way: Facing): Future {
  let now: WoodsState = {
    ...state,
    controls: { ...letGo(state), [way]: true },
  };
  const path: Spot[] = [];
  for (let at = 0; at < futureTicks; at += 1) {
    const before = now;
    now = tickWoods(now);
    const base = now.base;
    if (base === null || now.outcome !== null) break;
    if (
      now.hearts < before.hearts ||
      now.powers.shrinks > before.powers.shrinks
    )
      return { end: "hurt", path, way };
    if (found(before, now)) return { end: "find", path, way };
    const last = path[path.length - 1];
    if (
      (last === undefined || last.x !== base.x || last.y !== base.y) &&
      (base.x !== state.base?.x || base.y !== state.base.y)
    )
      path.push({ x: base.x, y: base.y });
  }
  return { end: "safe", path, way };
}

const worked = new WeakMap<WoodsState, readonly Future[]>();

export function futuresOf(state: WoodsState): readonly Future[] {
  const { base } = state;
  if (base === null || !visionOn(base, state.tick) || state.scene !== null)
    return [];
  const known = worked.get(state);
  if (known !== undefined) return known;
  const [left, right] = sides[base.facing];
  const futures = [base.facing, left, right].map((way) => playOut(state, way));
  worked.set(state, futures);
  return futures;
}

export const kitLeft = (state: WoodsState): number =>
  baseKit.length - kitCount(state);
