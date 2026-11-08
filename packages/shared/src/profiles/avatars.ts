// The pictures a player may choose for their profile. Presets only, so there is nothing to moderate: the platform draws each one (the
// sprites live in `@repo/ui`, keyed by these ids) and a profile stores only the id. Adding one is a line here and its sprite there; the
// ui test fails if the two lists drift apart.
export const profileAvatarIds = [
  "snowman",
  "penguin",
  "fox",
  "robot",
  "ghost",
  "alien",
  "dragon",
  "cat",
  "owl",
  "bear",
  "frog",
  "yeti",
] as const;
export type ProfileAvatarId = (typeof profileAvatarIds)[number];

export const isProfileAvatarId = (value: string): value is ProfileAvatarId =>
  (profileAvatarIds as readonly string[]).includes(value);
