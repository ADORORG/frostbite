import { packTaken, useItem, type Item } from "../kit.ts";
import { throwBlast } from "./blast.ts";
import { touching } from "./collide.ts";
import { heroHeight, heroWidth, pickupSize } from "./constants.ts";
import type { HillsState } from "./types.ts";

// The backpack in Egg Hills: its foods are picked up by touching them, and an item is used the moment its key is pressed. A berry also
// teaches Glitchy fire, if the stage's fire berry has not been found yet; a mushroom throws a glitch blast (`blast.ts`). The stage's own
// fire berry goes into the backpack once Glitchy can already breathe fire (`tick.ts`).
export function takeKit(state: HillsState): HillsState {
  const { hero, level } = state;
  const after = state.kitTaken.map((had, at) => {
    const spot = level.kit[at];
    return (
      had ||
      (spot !== undefined &&
        touching(
          hero.x,
          hero.y,
          heroWidth,
          heroHeight,
          spot.x,
          spot.y,
          pickupSize,
          pickupSize,
        ))
    );
  });
  const taken = packTaken(
    state.powers,
    level.kit,
    state.kitTaken,
    after,
    state.tick,
  );
  return taken.powers === state.powers ? state : { ...state, ...taken };
}

export function useKit(state: HillsState, item: Item): HillsState {
  const powers = useItem(state.powers, item, state.tick);
  if (powers === null) return state;
  const used = {
    ...state,
    hasFire: state.hasFire || item === "berry",
    powers,
  };
  return item === "mushroom" ? throwBlast(used) : used;
}
