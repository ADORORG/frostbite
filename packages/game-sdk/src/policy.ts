import "./zod-config.ts";
import { z } from "zod";

// What the host allows a game to do, as typed policy rather than constants in code. Changing a value is a
// configuration change, not a release.
export const gameHostPolicySchema = z
  .object({
    // The most a game may save, in bytes of its JSON text (64 KB by the product owner's decision).
    progressMaxBytes: z.number().int().min(1_024).max(1_048_576),
    // Saves and unlocks a game may make a minute; past it the call is refused with `rate_limited`.
    saveCallsPerMinute: z.number().int().min(1).max(600),
    unlockCallsPerMinute: z.number().int().min(1).max(600),
  })
  .strict();

export type GameHostPolicy = z.infer<typeof gameHostPolicySchema>;

export const defaultGameHostPolicy: GameHostPolicy = Object.freeze({
  progressMaxBytes: 65_536,
  saveCallsPerMinute: 60,
  unlockCallsPerMinute: 60,
});

export function resolveGameHostPolicy(
  overrides: Partial<GameHostPolicy> = {},
): GameHostPolicy {
  return Object.freeze(
    gameHostPolicySchema.parse({ ...defaultGameHostPolicy, ...overrides }),
  );
}
