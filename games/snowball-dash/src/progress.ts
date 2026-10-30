import {
  defaultSound,
  parseSound,
  type SoundSettings,
} from "@ador/game-sdk/audio/settings";

// What the platform may be handed back as this game's saved progress: anything else is a fresh game. The best distance is the game's own
// note for the player; milestones are kept by the platform. The sound settings are kept beside it, since the frame has no storage.
export interface Progress {
  readonly best: number;
  readonly sound: SoundSettings;
}

export const freshProgress: Progress = { best: 0, sound: defaultSound };

export function restore(saved: unknown): Progress {
  if (typeof saved === "object" && saved !== null && "best" in saved) {
    const { best } = saved;
    const sound = parseSound("sound" in saved ? saved.sound : undefined);
    if (typeof best === "number" && Number.isInteger(best) && best >= 0)
      return { best, sound };
  }
  return freshProgress;
}

export const withBest = (progress: Progress, metres: number): Progress =>
  metres > progress.best ? { ...progress, best: metres } : progress;

export const withSound = (
  progress: Progress,
  sound: SoundSettings,
): Progress => ({ ...progress, sound });
