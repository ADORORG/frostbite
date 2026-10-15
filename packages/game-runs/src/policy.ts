import { z } from "zod";

// What the platform allows of a player's runs, as typed policy: changing a value is a configuration change, not a release.
export const gameRunPolicySchema = z
  .object({
    // How many runs of one game a player may have open (issued and not yet submitted or expired) at once.
    maxOpenRuns: z.int().min(1).max(20),
    // How long a run can be played before it is submitted; after it, the run is expired and its seed is spent.
    runLifetimeMs: z.int().min(60_000).max(604_800_000),
  })
  .strict();
export type GameRunPolicy = z.infer<typeof gameRunPolicySchema>;

export const defaultGameRunPolicy: GameRunPolicy = Object.freeze({
  maxOpenRuns: 3,
  runLifetimeMs: 86_400_000,
});

export function resolveGameRunPolicy(
  overrides: Partial<GameRunPolicy> = {},
): GameRunPolicy {
  return Object.freeze(
    gameRunPolicySchema.parse({ ...defaultGameRunPolicy, ...overrides }),
  );
}
