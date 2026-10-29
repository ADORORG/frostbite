import { z } from "zod";

import { chainRefTextSchema } from "../chain/chain-ref.ts";
import {
  gameCoverAltLimit,
  gameCoverSchema,
  gameLaunchSchema,
} from "./launch.ts";
import { requestFingerprint } from "../http/fingerprint.ts";
import { gameRewardsSchema } from "./rewards.ts";

// The limits on what a game declares about itself. They bound what a public page must render.
export const gameManifestLimits = Object.freeze({
  capabilities: 16,
  coverAlt: gameCoverAltLimit,
  description: 2_000,
  milestoneCount: 1_000_000,
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
  "milestone:claim",
  "run:submit",
  "transaction:request",
  "wallet",
] as const;
export const gameCapabilitySchema = z.enum(gameCapabilities);

export const gameMilestoneClaimPolicies = ["once", "repeatable"] as const;

// How a milestone can be trusted. `self-reported` (the default when nothing is declared): the game said so, and nothing
// proves it. `replay-verified`: the game's own published rules decide it, and the platform replays a run on its server to
// check the claim (docs/product/run-record.md). It proves the run followed those rules, not that a person played it.
export const gameMilestoneVerifications = [
  "self-reported",
  "replay-verified",
] as const;

// A milestone a game says a player can earn, as data. Declaring one does not make it claimable on chain: that
// needs the game to declare a rewards contract too (`rewards`). A change to what a milestone means is a new
// manifest version, never an edit.
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
    // A repeatable milestone is counted each time the game reports it, up to this many; a count above it is
    // ignored. Required for a repeatable milestone (so a game that misreports cannot inflate a count without
    // limit) and meaningless for one earned once.
    maxCount: z
      .number()
      .int()
      .min(2)
      .max(gameManifestLimits.milestoneCount)
      .optional(),
    // A milestone earned once may need progress toward a goal (7 of 10 wins): the game reports the current total
    // and the milestone is earned when it reaches this number. Without one, the game reports it earned directly.
    target: z
      .number()
      .int()
      .min(2)
      .max(gameManifestLimits.milestoneCount)
      .optional(),
    title: z.string().trim().min(1).max(gameManifestLimits.milestoneTitle),
    // How this milestone can be trusted; left out, it is self-reported. Only a milestone earned once, with no target,
    // can be replay-verified: one run's verdict says what one run earned, not a running total.
    verification: z.enum(gameMilestoneVerifications).optional(),
  })
  .strict()
  .refine(
    ({ claimPolicy, maxCount }) =>
      claimPolicy === "repeatable"
        ? maxCount !== undefined
        : maxCount === undefined,
    {
      message:
        "A repeatable milestone needs a maximum count, and a milestone earned once cannot have one.",
      path: ["maxCount"],
    },
  )
  .refine(
    ({ claimPolicy, target }) => claimPolicy === "once" || target === undefined,
    {
      message: "Only a milestone earned once can have a target to reach.",
      path: ["target"],
    },
  )
  .refine(
    ({ claimPolicy, target, verification }) =>
      verification !== "replay-verified" ||
      (claimPolicy === "once" && target === undefined),
    {
      message:
        "Only a milestone earned once, with no target, can be replay-verified.",
      path: ["verification"],
    },
  );

// The game's published rules, which the platform replays runs with: the id and version the rules name themselves by (what a
// run record names), and the SHA-256 of the built `verifier.js` the platform loads from the game's own files. The digest is
// a pin: an artifact that does not match it is never run, so the rules change only with a new manifest.
export const gameReplayVerifierSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u),
    sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    version: z.number().int().min(1).max(0xffff),
  })
  .strict();

export * from "./launch.ts";
export * from "./rewards.ts";

export const gameManifestSchemaVersion = 1;

export const gameManifestSchema = z
  .object({
    capabilities: z
      .array(gameCapabilitySchema)
      .max(gameManifestLimits.capabilities)
      .refine((list) => new Set(list).size === list.length, {
        message: "A capability may be declared only once.",
      }),
    // Only a game the platform serves can have one, because the files must come with the game.
    cover: gameCoverSchema.optional(),
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
    // The platform's moving scene shown on the game's card (by the scene's id). Left out, one is chosen from the game's id. The platform
    // checks the id against the scenes it has when it builds its catalog, so a name it does not know is refused there, not ignored.
    scene: z
      .string()
      .regex(/^[a-z][a-z0-9-]{0,31}$/u)
      .optional(),
    schemaVersion: z.literal(gameManifestSchemaVersion),
    summary: z.string().trim().min(1).max(gameManifestLimits.summary),
    title: z.string().trim().min(1).max(gameManifestLimits.title),
    // The contract the game's milestones are claimed from; left out, none can be claimed on chain.
    rewards: gameRewardsSchema.optional(),
    // The game's own release version (any short text its team uses), separate from the manifest format.
    version: z.string().trim().min(1).max(gameManifestLimits.version),
    // How the game's milestones can be checked, beyond what the game says: left out, none can.
    verification: z
      .object({ replay: gameReplayVerifierSchema })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    ({ cover, launch }) => cover === undefined || launch.mode === "embedded",
    {
      message: "Only a game the platform plays itself can have a cover.",
      path: ["cover"],
    },
  )
  .refine(
    ({ launch, verification }) =>
      verification === undefined || launch.mode === "embedded",
    {
      message:
        "Only a game the platform plays itself can publish a replay verifier, because the artifact comes with its files.",
      path: ["verification"],
    },
  )
  .refine(
    ({ capabilities, verification }) =>
      verification === undefined || capabilities.includes("run:submit"),
    {
      message:
        "A game with a replay verifier must declare the run:submit capability, which is how it sends a run to be checked.",
      path: ["capabilities"],
    },
  )
  .refine(
    ({ milestones, rewards }) => rewards === undefined || milestones.length > 0,
    {
      message:
        "A game that declares a rewards contract needs at least one milestone to claim from it.",
      path: ["rewards"],
    },
  )
  .refine(
    ({ capabilities, rewards }) =>
      rewards !== undefined || !capabilities.includes("milestone:claim"),
    {
      message:
        "A game can declare the milestone:claim capability only with a rewards contract to claim from.",
      path: ["capabilities"],
    },
  )
  .refine(
    ({ milestones, verification }) =>
      verification !== undefined ||
      milestones.every(
        ({ verification: level }) => level !== "replay-verified",
      ),
    {
      message:
        "A milestone cannot be replay-verified in a game that publishes no replay verifier.",
      path: ["verification"],
    },
  )
  .refine(
    ({ milestones, verification }) =>
      verification === undefined ||
      milestones.some(({ verification: level }) => level === "replay-verified"),
    {
      message:
        "A replay verifier needs at least one milestone that declares replay verification.",
      path: ["verification"],
    },
  );

export type GameCover = z.infer<typeof gameCoverSchema>;
export type GameManifest = z.infer<typeof gameManifestSchema>;
export type GameMilestone = z.infer<typeof gameMilestoneSchema>;
export type GameCapability = z.infer<typeof gameCapabilitySchema>;
export type GameReplayVerifier = z.infer<typeof gameReplayVerifierSchema>;

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

// The address a player is sent to, or null when the game has no host configured.
export function gamePlayAddress(launch: GameManifest["launch"]): string | null {
  return launch.mode === "embedded" || launch.url === null
    ? null
    : new URL(launch.basePath === "" ? "/" : launch.basePath, launch.url).href;
}
