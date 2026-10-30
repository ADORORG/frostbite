// What the screen shows beside the run itself: whether a run is going, the best the player has done, and a line of news for the screen. None of
// it is part of the rules.
export type Phase = "over" | "ready" | "running";

export interface View {
  readonly best: number;
  readonly newBest: boolean;
  readonly phase: Phase;
  // A line shown for a moment (a milestone earned), and the tick it stops being shown.
  readonly toast: { readonly text: string; readonly until: number } | null;
}
