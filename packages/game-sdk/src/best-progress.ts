import {
  defaultSound,
  parseSound,
  type SoundSettings,
} from "./audio/settings.ts";

// What a game keeps for its player between visits, the same in every game that notes a best: the best the player has done and their sound
// settings (the frame has no storage, so the platform hands both back). Milestones are kept by the platform, not here. What the best is a
// best of (points, metres, height) is the game's own word for it.
export interface Progress {
  readonly best: number;
  readonly sound: SoundSettings;
}

export const freshProgress: Progress = { best: 0, sound: defaultSound };

// What the platform may hand back as a game's saved progress: anything else is a fresh game.
export function restore(saved: unknown): Progress {
  if (typeof saved === "object" && saved !== null && "best" in saved) {
    const { best } = saved;
    const sound = parseSound("sound" in saved ? saved.sound : undefined);
    if (typeof best === "number" && Number.isInteger(best) && best >= 0)
      return { best, sound };
  }
  return freshProgress;
}

export const withBest = (progress: Progress, score: number): Progress =>
  score > progress.best ? { ...progress, best: score } : progress;

export const withSound = (
  progress: Progress,
  sound: SoundSettings,
): Progress => ({ ...progress, sound });

export interface FinishedRun {
  // Whether this run beat the best the player had (a first run that scores nothing beats nothing).
  readonly newBest: boolean;
  readonly progress: Progress;
}

// The best, once a run has ended with a score: kept if it is higher, and said to be new only when it is.
export function finishRun(progress: Progress, score: number): FinishedRun {
  const next = withBest(progress, score);
  return { newBest: next.best > progress.best, progress: next };
}
