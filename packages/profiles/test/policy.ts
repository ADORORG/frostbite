import type { ProfilePolicy } from "../src/policy.ts";

// A policy for the tests: the bounds the deployment currently uses, with a few blocked words of its own.
export const policy: ProfilePolicy = {
  blockedTerms: ["admin", "frostbit", "staff"],
  changeCooldownDays: 30,
  maxLength: 20,
  minLength: 3,
};
