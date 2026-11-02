import { ahead } from "../grid.ts";
import {
  packTaken,
  startTileBlast,
  useItem,
  type Item,
  type KitSpot,
} from "../kit.ts";
import { baseKit } from "./base-map.ts";
import {
  cell,
  fireStep,
  frozen,
  lanternReach,
  mazeBlastReach,
  reach,
} from "./constants.ts";
import { along } from "./trig.ts";
import type { Base, WoodsState } from "./types.ts";
import { blocks, cellAt } from "./walk.ts";

// The backpack in the woods. In the maze a food is picked up by coming close to it, and out of the maze by stepping onto its tile; one is
// used the moment its key is pressed. A mushroom's glitch blast in the maze rolls straight ahead (`mazeBlast`); out of the maze it rolls
// over the tiles (`blast.ts`), one at a time.
const close = (state: WoodsState, spot: KitSpot): boolean =>
  Math.abs(state.x - (spot.x * cell + cell / 2)) <= reach &&
  Math.abs(state.y - (spot.y * cell + cell / 2)) <= reach;

export function takeMazeKit(state: WoodsState): WoodsState {
  const { kit } = state.level;
  const after = kit.map(
    (spot, at) => state.kitTaken[at] === true || close(state, spot),
  );
  const taken = packTaken(state.powers, kit, state.kitTaken, after, state.tick);
  return taken.powers === state.powers ? state : { ...state, ...taken };
}

export function takeBaseKit(state: WoodsState, base: Base): WoodsState {
  const after = baseKit.map(
    (spot, at) =>
      base.kitTaken[at] === true || (spot.x === base.x && spot.y === base.y),
  );
  const taken = packTaken(
    state.powers,
    baseKit,
    base.kitTaken,
    after,
    state.tick,
  );
  return taken.powers === state.powers
    ? { ...state, base }
    : {
        ...state,
        base: { ...base, kitTaken: taken.kitTaken },
        powers: taken.powers,
      };
}

// A glitch blast in the maze rolls straight ahead, much farther than fire: it lights every lantern it passes, melts the frozen hedge
// and rolls on through, and stops at a tree (or the moon gate while it is shut).
export function mazeBlast(state: WoodsState): WoodsState {
  const [dx, dy] = along(state.angle, fireStep);
  const lanterns = [...state.lanterns];
  let { melted } = state;
  for (let step = 1; step * fireStep <= mazeBlastReach; step += 1) {
    const x = state.x + dx * step;
    const y = state.y + dy * step;
    state.level.lanterns.forEach((place, at) => {
      if (
        Math.abs(x - (place.x * cell + cell / 2)) <= lanternReach &&
        Math.abs(y - (place.y * cell + cell / 2)) <= lanternReach
      )
        lanterns[at] = true;
    });
    const index = cellAt(x, y);
    if (state.level.walls[index] === frozen && !melted) melted = true;
    else if (blocks({ ...state, melted }, index)) break;
  }
  const lit = lanterns.some((on, at) => on && state.lanterns[at] !== true);
  const kind = lit ? "lantern" : melted !== state.melted ? "melt" : null;
  return {
    ...state,
    found: kind === null ? state.found : { kind, tick: state.tick },
    lanterns: lit ? lanterns : state.lanterns,
    melted,
  };
}

export function useKit(state: WoodsState, item: Item): WoodsState {
  const { base } = state;
  if (item === "mushroom" && base !== null && base.blast !== null) return state;
  const powers = useItem(state.powers, item, state.tick);
  if (powers === null) return state;
  const used = { ...state, powers };
  if (item !== "mushroom") return used;
  if (base === null) return mazeBlast(used);
  return {
    ...used,
    base: {
      ...base,
      blast: startTileBlast(base.x, base.y, ahead[base.facing], state.tick),
    },
  };
}
