// What the screen shows beside the run itself: whether a run is going, the best the player has done, where the cursor is and which shard is
// picked up, the cells to flash, and a line of news. None of it is part of the rules.
export type Phase = "over" | "ready" | "running";

export interface View {
  readonly best: number;
  // The cell the cursor is on, and the cell picked up to swap (-1 for none).
  readonly cursor: number;
  readonly flash: readonly number[];
  readonly grab: number;
  readonly newBest: boolean;
  readonly phase: Phase;
  readonly toast: string | null;
}
