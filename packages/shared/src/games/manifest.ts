import { z } from "zod";

import { chainRefTextSchema } from "../chain/chain-ref.ts";
import { requestFingerprint } from "../http/fingerprint.ts";

// The limits on what a game declares about itself. They bound what a public page must render.
export const gameManifestLimits = Object.freeze({
  capabilities: 16,
  description: 2_000,
  milestoneCriteria: 500,
  milestoneDescription: 500,
  milestoneTitle: 80,
  milestones: 64,
  summary: 200,
  title: 80,
  version: 32,
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

// The URL form of a game's identifier: lower-case words joined by hyphens. Stable for the life of the game,
// because it is in the page address and in every record that refers to the game.
export const gameIdSchema = z.string().min(2).max(64).regex(slugPattern);

// What a game may ask the host for (plan 8.7). A capability a game does not declare is never granted. The
// host protocol that enforces them is a later task; until then they are declarations only.
export const gameCapabilities = [
  "balance:read",
  "run:submit",
  "transaction:request",
  "wallet",
] as const;
export const gameCapabilitySchema = z.enum(gameCapabilities);

export const gameMilestoneClaimPolicies = ["once", "repeatable"] as const;

// A milestone a game says a player can earn, as data. Declaring one does not make it claimable: earning and
// claiming on chain need the attestation service and contract (ADR-018), which do not exist yet. A change to
// what a milestone means is a new manifest version, never an edit.
export const gameMilestoneSchema = z
  .object({
    claimPolicy: z.enum(gameMilestoneClaimPolicies),
    criteria: z
      .string()
      .trim()
      .min(1)
      .max(gameManifestLimits.milestoneCriteria),
    description: z
      .string()
      .trim()
      .min(1)
      .max(gameManifestLimits.milestoneDescription),
    id: gameIdSchema,
    title: z.string().trim().min(1).max(gameManifestLimits.milestoneTitle),
  })
  .strict();

// How a player reaches the game. `external`: the game runs on its own address. A null address means the
// game is registered but has no play address configured, and is shown as not playable.
export const gameLaunchSchema = z
  .object({
    mode: z.literal("external"),
    url: z.url({ protocol: /^https?$/u }).nullable(),
  })
  .strict();

export const gameManifestSchemaVersion = 1;

export const gameManifestSchema = z
  .object({
    capabilities: z
      .array(gameCapabilitySchema)
      .max(gameManifestLimits.capabilities)
      .refine((list) => new Set(list).size === list.length, {
        message: "A capability may be declared only once.",
      }),
    description: z.string().trim().max(gameManifestLimits.description),
    id: gameIdSchema,
    launch: gameLaunchSchema,
    milestones: z
      .array(gameMilestoneSchema)
      .max(gameManifestLimits.milestones)
      .refine(
        (list) => new Set(list.map(({ id }) => id)).size === list.length,
        { message: "A milestone id may appear only once in a game." },
      ),
    // The chain the game's own on-chain actions happen on.
    network: chainRefTextSchema,
    schemaVersion: z.literal(gameManifestSchemaVersion),
    summary: z.string().trim().min(1).max(gameManifestLimits.summary),
    title: z.string().trim().min(1).max(gameManifestLimits.title),
    // The game's own release version (any short text its team uses), separate from the manifest format.
    version: z.string().trim().min(1).max(gameManifestLimits.version),
  })
  .strict();

export type GameManifest = z.infer<typeof gameManifestSchema>;
export type GameMilestone = z.infer<typeof gameMilestoneSchema>;
export type GameCapability = z.infer<typeof gameCapabilitySchema>;

// Checks a manifest and freezes it: what a game file exports, so a mistake fails when the platform starts,
// not when a player opens the page.
export function defineGame(manifest: GameManifest): Readonly<GameManifest> {
  return Object.freeze(gameManifestSchema.parse(manifest));
}

// The games the platform lists, in the order given. An identifier may appear once: it is the page address.
export function defineGames(
  games: readonly GameManifest[],
): readonly Readonly<GameManifest>[] {
  const defined = games.map(defineGame);
  const seen = new Set<string>();
  for (const { id } of defined) {
    if (seen.has(id)) throw new Error(`Game "${id}" is registered twice.`);
    seen.add(id);
  }
  return Object.freeze(defined);
}

// A stable digest of everything a manifest declares, independent of key order. It identifies the exact
// version of a game's declarations, so a milestone or a launch address cannot change under the same hash.
export function gameManifestHash(manifest: GameManifest): string {
  return requestFingerprint(gameManifestSchema.parse(manifest));
}
