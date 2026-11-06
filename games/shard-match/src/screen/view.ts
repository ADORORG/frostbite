// What the screen shows beside the run itself: whether a run is going, the best the player has done, where the cursor is and which shard is
// picked up, a hint (the two cells of a swap worth making, shown after the player has been still a while), and a line of news. None of it is
// part of the rules.
import type { Phase } from "@frostbite/game-sdk/card";

import type { Shape } from "./layout.ts";

export type { Phase };

export interface View {
  readonly best: number;
  // The cell the cursor is on, and the cell picked up to swap (-1 for none).
  readonly cursor: number;
  readonly grab: number;
  readonly hint: readonly number[];
  readonly newBest: boolean;
  readonly phase: Phase;
  // Which screen is drawn: the wide one, or the tall one for a phone held upright.
  readonly shape: Shape;
  readonly toast: string | null;
}

// What the screen shows before the first run: nothing picked up, the cursor on the first cell, the wide screen.
export const firstView: View = {
  best: 0,
  cursor: 0,
  grab: -1,
  hint: [],
  newBest: false,
  phase: "ready",
  shape: "wide",
  toast: null,
};
