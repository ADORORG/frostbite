import {
  defaultSound,
  parseSound,
  type SoundSettings,
} from "@ador/game-sdk/audio/settings";

import { chapterIds, type ChapterId } from "./rules/constants.ts";

// What the platform may be handed back as this game's saved progress; anything else is a fresh game. It is how far the player has got
// (how many chapters are open, and whether the castle has been captured), the best score in each chapter, the metaplasma banked from
// every run (to be turned into items one day; it takes a great deal), and the sound settings, since the frame has no storage of its own.
export interface Progress {
  readonly best: Readonly<Record<ChapterId, number>>;
  readonly plasma: number;
  readonly sound: SoundSettings;
  readonly unlocked: number;
  readonly won: boolean;
}

export const freshProgress: Progress = {
  best: { castle: 0, hills: 0, woods: 0 },
  plasma: 0,
  sound: defaultSound,
  unlocked: 1,
  won: false,
};

const highestScore = 100_000_000;
const mostPlasma = 1_000_000_000_000;

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
  const plasma = count("plasma" in saved ? saved.plasma : 0, mostPlasma);
  const won = "won" in saved ? saved.won : false;
  if (
    unlocked === null ||
    unlocked < 1 ||
    best === null ||
    plasma === null ||
    typeof won !== "boolean"
  )
    return freshProgress;
  return {
    best,
    plasma,
    sound: parseSound("sound" in saved ? saved.sound : undefined),
    unlocked,
    won,
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

// Clearing a chapter opens the next one (and the last stays the last); clearing the last captures the castle.
export const withCleared = (
  progress: Progress,
  chapter: ChapterId,
): Progress => ({
  ...progress,
  unlocked: Math.max(
    progress.unlocked,
    Math.min(chapterIds.length, chapterIds.indexOf(chapter) + 2),
  ),
  won: progress.won || chapter === chapterIds[chapterIds.length - 1],
});

// A finished run's metaplasma goes into the bank.
export const withPlasma = (progress: Progress, gathered: number): Progress => ({
  ...progress,
  plasma: Math.min(mostPlasma, progress.plasma + gathered),
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
  plasma: progress.plasma,
  sound: progress.sound,
  unlocked: progress.unlocked,
  won: progress.won,
});
