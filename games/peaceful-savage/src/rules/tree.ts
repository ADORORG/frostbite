import { points } from "./constants.ts";
import {
  canRise,
  mirrorForceCap,
  treePowerRest,
  treePowerSpark,
  treeRecoveredAt,
  withSpark,
} from "./growth.ts";
import { healedCount, withNews, withPoints } from "./state.ts";
import type { PlayState } from "./types.ts";

// A hand on the ancestor tree. The first touch wakes it and it gives Savage Vision. After that, light enough raises the lead a level
// (one level a touch); and once the tree has recovered (half the grey ones healed) it powers the lead up as well, with spark and a
// charge of mirror force, once every thirty seconds. Otherwise it only shows the way again.
export function touchTree(state: PlayState): PlayState {
  if (!state.touchedTree)
    return withNews(
      withPoints({ ...state, touchedTree: true }, points.touch),
      "touch",
    );
  const risen = canRise(state) ? { ...state, level: state.level + 1 } : state;
  const recovered = healedCount(state) >= treeRecoveredAt;
  if (recovered && state.tick >= state.treeReady) {
    const powered = withSpark(
      {
        ...risen,
        mirrorForce: Math.min(mirrorForceCap, risen.mirrorForce + 1),
        treeReady: state.tick + treePowerRest,
      },
      treePowerSpark,
    );
    return withNews(
      powered,
      risen === state ? "power" : "level",
      String(risen.level),
    );
  }
  return risen === state
    ? withNews(state, "touch", "again")
    : withNews(risen, "level", String(risen.level));
}
