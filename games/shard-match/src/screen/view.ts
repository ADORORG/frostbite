// What the screen shows beside the run itself: whether a run is going, the best the player has done, where the cursor is and which shard is
// picked up, a hint (the two cells of a swap worth making, shown after the player has been still a while), and a line of news. None of it is
// part of the rules.
import type { Shape } from "./layout.ts";

export type Phase = "over" | "ready" | "running";

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
