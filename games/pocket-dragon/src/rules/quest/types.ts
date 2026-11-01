import type { ChapterId } from "../constants.ts";
import type { LegRun } from "./legs.ts";

// The whole quest as one run: the level being played, the ones finished before it, and the dimension shift between two levels.
export interface QuestState {
  readonly ended: boolean;
  // The quest tick the last level was cleared on, or null.
  readonly finishTick: number | null;
  // The level being played; while the dimension shifts, the one just cleared; once lost, the one it was lost in.
  readonly leg: LegRun;
  readonly lost: boolean;
  // The levels cleared before this one, as they ended.
  readonly past: readonly LegRun[];
  readonly seed: number;
  // Between two levels: the ticks of the shift still to go, and the level it leads to.
  readonly shift: { readonly left: number; readonly to: ChapterId } | null;
  readonly tick: number;
}
