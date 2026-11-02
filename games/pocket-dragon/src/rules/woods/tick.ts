import {
  backSpeed,
  cell,
  fireCooldown,
  fireReach,
  fireStep,
  frozen,
  gate,
  lanternReach,
  magnetReach,
  plasmaCatch,
  plasmaReach,
  plasmaSpeed,
  reach,
  swiftSpeed,
  turnSpeed,
  walkSpeed,
} from "./constants.ts";
import { pullPlasma } from "../plasma.ts";
import { startBase } from "./base.ts";
import { tickBase } from "./base-tick.ts";
import { playScene, sceneOn } from "./scenes.ts";
import { along, fullTurn } from "./trig.ts";
import { blocks, cellAt, slide } from "./walk.ts";
import type { Place, WoodsState } from "./types.ts";

const centre = (place: Place): readonly [number, number] => [
  place.x * cell + cell / 2,
  place.y * cell + cell / 2,
];
const near = (state: WoodsState, place: Place, within: number): boolean => {
  const [cx, cy] = centre(place);
  return Math.abs(state.x - cx) <= within && Math.abs(state.y - cy) <= within;
};

// A breath of fire: it goes straight ahead in short steps, melts the frozen hedge if it meets it, lights the first unlit lantern it passes
// close to, and stops at a tree.
export function breatheFire(state: WoodsState): WoodsState {
  if (state.fireCooldown > 0) return state;
  const breathed = {
    ...state,
    breathTick: state.tick,
    breaths: state.breaths + 1,
    fireCooldown: fireCooldown,
  };
  const [dx, dy] = along(state.angle, fireStep);
  for (let step = 1; step * fireStep <= fireReach; step += 1) {
    const x = state.x + dx * step;
    const y = state.y + dy * step;
    const lantern = state.level.lanterns.findIndex((place, at) => {
      const [cx, cy] = centre(place);
      return (
        state.lanterns[at] !== true &&
        Math.abs(x - cx) <= lanternReach &&
        Math.abs(y - cy) <= lanternReach
      );
    });
    if (lantern >= 0)
      return {
        ...breathed,
        found: { kind: "lantern", tick: state.tick },
        lanterns: state.lanterns.map((lit, at) => lit || at === lantern),
      };
    const index = cellAt(x, y);
    if (state.level.walls[index] === frozen && !state.melted)
      return {
        ...breathed,
        found: { kind: "melt", tick: state.tick },
        melted: true,
      };
    if (blocks(state, index)) return breathed;
  }
  return breathed;
}

// What of `places` has been picked up after this tick: the very same list when nothing new was close, so a find shows as a new list.
const gather = (
  state: WoodsState,
  places: readonly Place[],
  had: readonly boolean[],
): readonly boolean[] => {
  const now = places.map(
    (place, at) => had[at] === true || near(state, place, reach),
  );
  return now.some((got, at) => got !== had[at]) ? now : had;
};

// Picking up the launcher's parts, eggs and secret charms, and the metaplasma drifting to Glitchy.
function pickUp(state: WoodsState, tick: number): WoodsState {
  const parts = gather(state, state.level.parts, state.parts);
  const eggs = gather(state, state.level.eggs, state.eggs);
  const charms = gather(state, state.level.charms, state.charms);
  const plasma = pullPlasma(state.plasma, state.level.motes, state.x, state.y, {
    catchWithin: plasmaCatch,
    reach: state.charms[2] === true ? magnetReach : plasmaReach,
    speed: plasmaSpeed,
  });
  const found: WoodsState["found"] =
    parts !== state.parts
      ? { kind: parts.every(Boolean) ? "launcher" : "part", tick }
      : charms !== state.charms
        ? { kind: "charm", tick }
        : eggs !== state.eggs
          ? { kind: "egg", tick }
          : state.found;
  return { ...state, charms, eggs, found, parts, plasma };
}

// One tick of the woods: while a scene plays only the clock moves; out of the maze, the woods seen from above (`base-tick.ts`); in the
// maze, Glitchy turns and walks, takes what is close, and steps through the moon gate if it is open (and the camera rises over the trees).
export function tickWoods(before: WoodsState): WoodsState {
  if (before.scene !== null)
    return sceneOn({ ...before, tick: before.tick + 1 });
  if (before.base !== null)
    return tickBase({ ...before, tick: before.tick + 1 });
  const state = before;
  const { controls } = state;
  const turn = (Number(controls.right) - Number(controls.left)) * turnSpeed;
  const angle = (((state.angle + turn) % fullTurn) + fullTurn) % fullTurn;
  const forward = state.charms[0] === true ? swiftSpeed : walkSpeed;
  const speed = controls.up ? forward : controls.down ? -backSpeed : 0;
  const [dx, dy] = along(angle, speed);
  const turned = { ...state, angle };
  const moved = speed === 0 ? turned : { ...turned, ...slide(turned, dx, dy) };
  const here = cellAt(moved.x, moved.y);
  const tick = state.tick + 1;
  const chests = moved.chests.map(
    (open, at) =>
      open || near(moved, moved.level.chests[at] ?? { x: -9, y: -9 }, reach),
  );
  const clues = moved.clues.map(
    (read, at) =>
      read || near(moved, moved.level.clues[at] ?? { x: -9, y: -9 }, reach),
  );
  const moonChest =
    moved.moonChest || near(moved, moved.level.moonChest, reach);
  const newly = (
    after: readonly boolean[],
    before: readonly boolean[],
  ): boolean => after.some((done, at) => done && before[at] !== true);
  const found: WoodsState["found"] = newly(clues, moved.clues)
    ? { kind: "clue", tick }
    : newly(chests, moved.chests)
      ? { kind: "chest", tick }
      : moonChest && !moved.moonChest
        ? { kind: "moon", tick }
        : moved.found;
  const next: WoodsState = pickUp(
    {
      ...moved,
      chests,
      clues,
      fireCooldown: Math.max(0, moved.fireCooldown - 1),
      found,
      moonChest,
      tick,
      visited:
        moved.visited[here] === true
          ? moved.visited
          : moved.visited.map((seen, at) => seen || at === here),
    },
    tick,
  );
  return here === next.level.gate &&
    next.level.walls[here] === gate &&
    !blocks(next, here)
    ? playScene(
        {
          ...next,
          base: startBase(next),
          escapeTick: next.tick,
          escaped: true,
        },
        "rise",
      )
    : next;
}

export const cluesRead = (state: WoodsState): number =>
  state.clues.filter(Boolean).length;
export const chestsOpened = (state: WoodsState): number =>
  state.chests.filter(Boolean).length;
export const lanternsLit = (state: WoodsState): number =>
  state.lanterns.filter(Boolean).length;
