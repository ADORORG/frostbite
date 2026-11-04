import { z } from "zod";

// What a game is like, in the platform's own words. The list is closed on purpose: a free-text tag drifts ("puzzle", "Puzzles",
// "puzzel") and the games page builds its filter from these, so one spelling each keeps the filter honest. A game picks the few
// that fit it; a new kind of game adds one line here and one label below.
export const gameTags = [
  "action",
  "arcade",
  "developer",
  "endless",
  "platformer",
  "puzzle",
  "reflex",
  "rhythm",
  "strategy",
] as const;
export const gameTagSchema = z.enum(gameTags);
export type GameTag = z.infer<typeof gameTagSchema>;

// A game says what it is in a few tags, not a list: a card with many tags says nothing.
export const gameTagLimit = 4;

export const gameTagLabels: Readonly<Record<GameTag, string>> = {
  action: "Action",
  arcade: "Arcade",
  developer: "Developer tool",
  endless: "Endless",
  platformer: "Platformer",
  puzzle: "Puzzle",
  reflex: "Reflex",
  rhythm: "Rhythm",
  strategy: "Strategy",
};

// At least one, so every game can be found by what it is, and none twice.
export const gameTagsSchema = z
  .array(gameTagSchema)
  .min(1)
  .max(gameTagLimit)
  .refine((list) => new Set(list).size === list.length, {
    message: "A tag may be declared only once.",
  });
