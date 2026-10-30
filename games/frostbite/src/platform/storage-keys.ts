// The keys the game keeps across visits, which the platform saves for it (progress, 64 KB at most). They are the
// game's own, from the original page: what the player has burned, voted for and levelled up. Everything else the
// game writes (its telemetry log, a handle typed into a form) lasts only as long as the page.
// The sound the player chose for the cabinets (the new, replayable ones): they write it, not the original page.
export const soundKey = "frostbite.sound.v1";

export const persistedKeys = [
  "frostbite.burned.v1",
  "frostbite.levels.v1",
  soundKey,
  "frostbite.votes.v1",
] as const;
