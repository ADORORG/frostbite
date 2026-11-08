import type { ProfilePolicy } from "@frostbite/feature-profiles";

// What bounds a player's profile name. The length is what fits a card and a page address; the cooldown is how long a player must keep a name
// before changing it, so a name cannot be swapped to pass as someone else. The blocked words are lower case letters and digits; a name is
// checked against them after it is lower-cased, stripped of `_` and `-`, and its look-alike digits read as letters, so "Adm1n" is caught.
// They are the platform's own words and the ones that would pass a player off as the platform's staff; the operator extends this list.
export const profilePolicy = {
  blockedTerms: [
    "admin",
    "administrator",
    "frostbit",
    "moderator",
    "official",
    "staff",
    "support",
    "system",
  ],
  changeCooldownDays: 30,
  maxLength: 20,
  minLength: 3,
} satisfies ProfilePolicy;
