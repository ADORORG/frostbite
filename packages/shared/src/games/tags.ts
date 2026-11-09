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

// The kinds the games page offers as filters. They are fewer than the tags on purpose: "platformer" is a kind of action game, and "reflex"
// and "endless" are ways an arcade game plays, so a person choosing among five reads one list, not nine overlapping ones. Each kind is
// also a tag (the type says so), so its words are the tag's words. A new kind of game adds its tag above, and here only if it earns a chip.
export const gameFilterKinds = [
  "action",
  "arcade",
  "puzzle",
  "rhythm",
  "strategy",
] as const satisfies readonly GameTag[];
export const gameFilterKindSchema = z.enum(gameFilterKinds);
export type GameFilterKind = z.infer<typeof gameFilterKindSchema>;

// Which filter kind each tag falls under; null for a tag that is not a kind of game (a developer tool gets no chip). A record over every
// tag, so a new tag cannot be added without deciding where it goes.
export const gameTagKind: Readonly<Record<GameTag, GameFilterKind | null>> = {
  action: "action",
  arcade: "arcade",
  developer: null,
  endless: "arcade",
  platformer: "action",
  puzzle: "puzzle",
  reflex: "arcade",
  rhythm: "rhythm",
  strategy: "strategy",
};

// The filter kinds a game falls under, in the filter's order, each once.
export const gameKindsOf = (
  tags: readonly GameTag[],
): readonly GameFilterKind[] =>
  gameFilterKinds.filter((kind) =>
    tags.some((tag) => gameTagKind[tag] === kind),
  );

// At least one, so every game can be found by what it is, and none twice.
export const gameTagsSchema = z
  .array(gameTagSchema)
  .min(1)
  .max(gameTagLimit)
  .refine((list) => new Set(list).size === list.length, {
    message: "A tag may be declared only once.",
  });
