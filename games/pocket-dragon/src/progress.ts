import {
  defaultSound,
  parseSound,
  type SoundSettings,
} from "@ador/game-sdk/audio/settings";

import { chapterIds, type ChapterId } from "./rules/constants.ts";

// What the platform may be handed back as this game's saved progress; anything else is a fresh game. It is how far the player has got
// (how many chapters are open), the best score in each chapter, and the sound settings, since the frame has no storage of its own.
export interface Progress {
  readonly best: Readonly<Record<ChapterId, number>>;
  readonly sound: SoundSettings;
  readonly unlocked: number;
}

export const freshProgress: Progress = {
  best: { castle: 0, hills: 0, woods: 0 },
  sound: defaultSound,
  unlocked: 1,
};

const highestScore = 100_000_000;

const count = (value: unknown, most: number): number | null =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= most
    ? value
    : null;

// A chapter with no best saved has not been scored yet.
function bests(best: object): Progress["best"] | null {
  const hills = count("hills" in best ? best.hills : 0, highestScore);
  const woods = count("woods" in best ? best.woods : 0, highestScore);
  const castle = count("castle" in best ? best.castle : 0, highestScore);
  return hills === null || woods === null || castle === null
    ? null
    : { castle, hills, woods };
}

export function restore(saved: unknown): Progress {
  if (typeof saved !== "object" || saved === null) return freshProgress;
  const unlocked = count(
    "unlocked" in saved ? saved.unlocked : 1,
    chapterIds.length,
  );
  // No best saved is a game not scored yet; a best that is not a record of scores is not this game's save.
  const best = !("best" in saved)
    ? bests({})
    : typeof saved.best === "object" && saved.best !== null
      ? bests(saved.best)
      : null;
  if (unlocked === null || unlocked < 1 || best === null) return freshProgress;
  return {
    best,
    sound: parseSound("sound" in saved ? saved.sound : undefined),
    unlocked,
  };
}

export const withBest = (
  progress: Progress,
  chapter: ChapterId,
  score: number,
): Progress =>
  score > progress.best[chapter]
    ? { ...progress, best: { ...progress.best, [chapter]: score } }
    : progress;

// Clearing a chapter opens the next one (and the last stays the last).
export const withCleared = (
  progress: Progress,
  chapter: ChapterId,
): Progress => ({
  ...progress,
  unlocked: Math.max(
    progress.unlocked,
    Math.min(chapterIds.length, chapterIds.indexOf(chapter) + 2),
  ),
});

export const withSound = (
  progress: Progress,
  sound: SoundSettings,
): Progress => ({ ...progress, sound });

export const isOpen = (progress: Progress, chapter: ChapterId): boolean =>
  chapterIds.indexOf(chapter) < progress.unlocked;

// What is saved: everything in `Progress`, as plain data.
export const saved = (progress: Progress) => ({
  best: progress.best,
  sound: progress.sound,
  unlocked: progress.unlocked,
});
