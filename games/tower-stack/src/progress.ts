// What the platform may be handed back as this game's saved progress: anything else is a fresh game. The best height is the game's own note
// for the player; milestones are kept by the platform.
export interface Progress {
  readonly best: number;
}

export const freshProgress: Progress = { best: 0 };

export function restore(saved: unknown): Progress {
  if (typeof saved === "object" && saved !== null && "best" in saved) {
    const { best } = saved;
    if (typeof best === "number" && Number.isInteger(best) && best >= 0)
      return { best };
  }
  return freshProgress;
}

export const withBest = (progress: Progress, height: number): Progress =>
  height > progress.best ? { best: height } : progress;
