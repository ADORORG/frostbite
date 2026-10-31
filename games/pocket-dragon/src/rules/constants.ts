// What the whole game shares: its id, the one verifier its three chapters are published behind, and the rate the rules count time
// at. Each chapter's own numbers are in its folder (`hills/`, `woods/`, `castle/`).
export const gameId = "pocket-dragon";
export const verifierId = "pocket-dragon";
// Raised with any change to any chapter's rules, so a run begun under older rules is never replayed under newer ones.
export const verifierVersion = 1;
export const ticksPerSecond = 60;

// The chapters, in the order they are played and unlocked. Each is a cabinet of the one verifier, named in a run's settings.
export const chapterIds = ["hills", "woods", "castle"] as const;
export type ChapterId = (typeof chapterIds)[number];
