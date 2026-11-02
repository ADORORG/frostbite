import {
  blastNext,
  blastRolled,
  packTaken,
  startTileBlast,
  useItem,
  type Item,
} from "../kit.ts";
import { blastDizzy } from "./constants.ts";
import { stunAt } from "./night.ts";
import { ice, kitSpots } from "./places.ts";
import { ahead, land, say } from "./world.ts";
import type { CastleState } from "./types.ts";

// The backpack in the guild's land: a food is picked up by stepping onto it, and used the moment its key is pressed (not in a cheer
// challenge, which has moves of its own). A mushroom's glitch blast rolls out from Glitchy the way it faces, a tile at a time, over the
// land and through the guards (each is left dizzy a long while and drops its egg), melting the ice around Bloom's seeds on its way; it
// stops at anything else that cannot be walked through. Indoors a blast has no room to roll, so the mushroom stays in the backpack.
export function takeKit(state: CastleState): CastleState {
  if (state.room >= 0) return state;
  const after = kitSpots.map(
    (spot, at) =>
      state.kitTaken[at] === true || (spot.x === state.x && spot.y === state.y),
  );
  const taken = packTaken(
    state.powers,
    kitSpots,
    state.kitTaken,
    after,
    state.tick,
  );
  return taken.powers === state.powers ? state : { ...state, ...taken };
}

export function useKit(state: CastleState, item: Item): CastleState {
  if (
    state.battle !== null ||
    (item === "mushroom" && (state.room >= 0 || state.blast !== null))
  )
    return state;
  const powers = useItem(state.powers, item, state.tick);
  if (powers === null) return state;
  return item === "mushroom"
    ? {
        ...state,
        blast: startTileBlast(
          state.x,
          state.y,
          ahead[state.facing],
          state.tick,
        ),
        powers,
      }
    : { ...state, powers };
}

export function rollBlast(state: CastleState): CastleState {
  const { blast } = state;
  if (blast === null) return state;
  const to = blastNext(blast, state.tick);
  if (to === null) return blast.left <= 0 ? { ...state, blast: null } : state;
  const thawed =
    to.x === ice.x && to.y === ice.y && !state.melted
      ? say({ ...state, melted: true }, "melted")
      : state;
  const stunned = stunAt(thawed, to.x, to.y, blastDizzy) ?? thawed;
  return {
    ...stunned,
    blast: land(stunned, to.x, to.y)
      ? blastRolled(blast, to, state.tick)
      : null,
  };
}
