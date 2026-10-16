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
    // Progress totals a game may report a minute (a game reports on each kill or coin, so this is generous).
    progressCallsPerMinute: z.number().int().min(1).max(6_000),
    // The most a run record a game submits may be, in bytes of its JSON text (the run record's own ceiling).
    runRecordMaxBytes: z.number().int().min(1_024).max(1_048_576),
    // Runs a game may start and submit a minute together; a replay costs the platform real work.
    runCallsPerMinute: z.number().int().min(1).max(600),
    // Claims a game may ask the platform to start a minute; each can open a review the player has to deal with.
    claimCallsPerMinute: z.number().int().min(1).max(60),
    // Times a game may ask the page to open the wallet chooser a minute; a game must not keep a dialog in the way.
    connectCallsPerMinute: z.number().int().min(1).max(60),
    // Messages a game may ask the page to show a minute; the player is not to be spammed.
    toastCallsPerMinute: z.number().int().min(1).max(60),
    unlockCallsPerMinute: z.number().int().min(1).max(600),
  })
  .strict();

export type GameHostPolicy = z.infer<typeof gameHostPolicySchema>;

export const defaultGameHostPolicy: GameHostPolicy = Object.freeze({
  claimCallsPerMinute: 6,
  connectCallsPerMinute: 6,
  progressCallsPerMinute: 120,
  progressMaxBytes: 65_536,
  runCallsPerMinute: 30,
  runRecordMaxBytes: 65_536,
  saveCallsPerMinute: 60,
  toastCallsPerMinute: 6,
  unlockCallsPerMinute: 60,
});

export function resolveGameHostPolicy(
  overrides: Partial<GameHostPolicy> = {},
): GameHostPolicy {
  return Object.freeze(
    gameHostPolicySchema.parse({ ...defaultGameHostPolicy, ...overrides }),
  );
}
