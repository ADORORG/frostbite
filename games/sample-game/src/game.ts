// The game's own rules, with no page and no platform in them, so they can be tested alone.
export interface GameState {
  readonly score: number;
}

export const startState: GameState = { score: 0 };

// What the platform may be handed back as this game's saved state: anything else is a fresh game.
export function restore(saved: unknown): GameState {
  if (typeof saved === "object" && saved !== null && "score" in saved) {
    const { score } = saved;
    if (typeof score === "number" && Number.isInteger(score) && score >= 0)
      return { score };
  }
  return startState;
}

export const tap = (state: GameState): GameState => ({
  score: state.score + 1,
});

// The milestones this game declares (see configs/games/sample.ts) and the score that earns each.
export const milestoneThresholds = [
  { id: "first-five", score: 5 },
  { id: "ten-taps", score: 10 },
] as const;

export function earned(state: GameState): string[] {
  return milestoneThresholds
    .filter(({ score }) => state.score >= score)
    .map(({ id }) => id);
}
