import type { Card, Guide, ResultCard } from "./guide.ts";

// What a game's screen shows beside the run itself, the same in every game that has a card after a run: whether a run is going, the best the
// player has done, and a line of news for the screen (a milestone earned) with the tick or move it stops being shown on. None of it is part of
// the rules.
export type Phase = "over" | "ready" | "running";

export interface RunView {
  readonly best: number;
  readonly newBest: boolean;
  readonly phase: Phase;
  readonly toast: { readonly text: string; readonly until: number } | null;
}

// What is over the screen: the first-screen card while the game waits to begin, the card after a run once it is over, and nothing while a run
// goes. The words and rows are the game's own; which of them is shown when is the same everywhere, so it is decided here once.
export function cardFor(
  phase: Phase,
  guide: Guide,
  result: () => ResultCard | null,
): Card | null {
  if (phase === "ready") return guide;
  return phase === "over" ? result() : null;
}
