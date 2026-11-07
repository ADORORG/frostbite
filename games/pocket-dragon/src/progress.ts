import {
  defaultSound,
  parseSound,
  type SoundSettings,
} from "@frostbite/game-sdk/audio/settings";

import { chapterIds, type ChapterId, type PlayId } from "./rules/constants.ts";

// What the platform may be handed back as this game's saved progress; anything else is a fresh game. It is how far the player has got
// (how many levels are open to practise, and whether the quest has been won), the best score of the quest and of each level, the Hall of
// Fame of won quests, the metaplasma banked from every run (to be turned into items one day; it takes a great deal), and the sound
// settings, since the frame has no storage of its own.
export interface FameEntry {
  readonly eggs: number;
  readonly hearts: number;
  readonly score: number;
  readonly secrets: number;
  readonly ticks: number;
}

export interface Progress {
  readonly best: Readonly<Record<PlayId, number>>;
  readonly fame: readonly FameEntry[];
  readonly plasma: number;
  readonly sound: SoundSettings;
  readonly unlocked: number;
  readonly won: boolean;
}

export const freshProgress: Progress = {
  best: { castle: 0, hills: 0, quest: 0, woods: 0 },
  fame: [],
  plasma: 0,
  sound: defaultSound,
  unlocked: 1,
  won: false,
};

const highestScore = 100_000_000;
const mostPlasma = 1_000_000_000_000;
// The Hall of Fame keeps this many won quests.
export const fameSize = 10;
const fameLimits: Readonly<Record<keyof FameEntry, number>> = {
  eggs: 100_000,
  hearts: 99,
  score: highestScore,
  secrets: 1_000,
  ticks: 100_000_000,
};

const count = (value: unknown, most: number): number | null =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= most
    ? value
    : null;

// A level (or the quest) with no best saved has not been scored yet.
function bests(best: object): Progress["best"] | null {
  const hills = count("hills" in best ? best.hills : 0, highestScore);
  const woods = count("woods" in best ? best.woods : 0, highestScore);
  const castle = count("castle" in best ? best.castle : 0, highestScore);
  const quest = count("quest" in best ? best.quest : 0, highestScore);
  return hills === null || woods === null || castle === null || quest === null
    ? null
    : { castle, hills, quest, woods };
}

function fameEntry(entry: unknown): FameEntry | null {
  if (typeof entry !== "object" || entry === null) return null;
  const read = (name: keyof FameEntry): number | null =>
    count(name in entry ? Reflect.get(entry, name) : null, fameLimits[name]);
  const eggs = read("eggs");
  const hearts = read("hearts");
  const score = read("score");
  const secrets = read("secrets");
  const ticks = read("ticks");
  return eggs === null ||
    hearts === null ||
    score === null ||
    secrets === null ||
    ticks === null
    ? null
    : { eggs, hearts, score, secrets, ticks };
}

// No Hall of Fame saved is an empty one; one that is not a short list of won quests is not this game's save.
function fameOf(fame: unknown): readonly FameEntry[] | null {
  if (fame === undefined) return [];
  if (!Array.isArray(fame) || fame.length > fameSize) return null;
  const entries = fame.map(fameEntry);
  return entries.every((entry) => entry !== null) ? entries : null;
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
  const fame = fameOf("fame" in saved ? saved.fame : undefined);
  if (
    fame === null ||
    unlocked === null ||
    unlocked < 1 ||
    best === null ||
    plasma === null ||
    typeof won !== "boolean"
  )
    return freshProgress;
  return {
    best,
    fame,
    plasma,
    sound: parseSound("sound" in saved ? saved.sound : undefined),
    unlocked,
    won,
  };
}

export const withBest = (
  progress: Progress,
  play: PlayId,
  score: number,
): Progress =>
  score > progress.best[play]
    ? { ...progress, best: { ...progress.best, [play]: score } }
    : progress;

// A won quest goes into the Hall of Fame if it is among the best (by score, then by time); its place there, or null.
export function withFame(
  progress: Progress,
  entry: FameEntry,
): { readonly progress: Progress; readonly rank: number | null } {
  const ranked = [...progress.fame, entry]
    .sort((a, b) => b.score - a.score || a.ticks - b.ticks)
    .slice(0, fameSize);
  const at = ranked.indexOf(entry);
  return {
    progress: { ...progress, fame: ranked },
    rank: at < 0 ? null : at + 1,
  };
}

// Clearing a level opens the next one to practise (and the last stays the last); clearing the last wins the quest's story.
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

// The quest is always open; a level is open to practise once the one before it has been cleared.
export const isOpen = (progress: Progress, play: PlayId): boolean =>
  play === "quest" || chapterIds.indexOf(play) < progress.unlocked;

// What is saved: everything in `Progress`, as plain data.
export const saved = (progress: Progress) => ({
  best: progress.best,
  fame: progress.fame.map((entry) => ({
    eggs: entry.eggs,
    hearts: entry.hearts,
    score: entry.score,
    secrets: entry.secrets,
    ticks: entry.ticks,
  })),
  plasma: progress.plasma,
  sound: progress.sound,
  unlocked: progress.unlocked,
  won: progress.won,
});
