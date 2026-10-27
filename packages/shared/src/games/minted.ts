import { z } from "zod";

import { gameIdSchema } from "./manifest.ts";

// A milestone a player has minted: a claim the network's records show complete. Only complete claims are listed, because a claim
// that is waiting, delayed or failed has minted nothing. The platform follows the claim; whether the item is still with the player
// is not known here.
export const mintedMilestoneSchema = z
  .object({
    claimId: z.uuid(),
    gameId: gameIdSchema,
    // When the platform recorded the claim as complete.
    mintedAt: z.iso.datetime({ offset: true }),
    milestoneId: gameIdSchema,
    transactionId: z.string().min(1).max(128),
  })
  .strict();

export const listMintedMilestonesInputSchema = z.object({}).strict();
export const listMintedMilestonesResponseSchema = z
  .object({ minted: z.array(mintedMilestoneSchema).max(500) })
  .strict();

export const listMintedMilestonesRoute = {
  method: "POST",
  operationId: "listMintedMilestones",
  path: "/api/v1/games/milestones/minted",
} as const;

// The player's own page of what they minted.
export const myMilestonesPath = "/games/milestones";
export const myMilestonesNavigationLabel = "My milestones";

export type MintedMilestone = z.infer<typeof mintedMilestoneSchema>;
export type ListMintedMilestonesInput = z.infer<
  typeof listMintedMilestonesInputSchema
>;
export type ListMintedMilestonesResponse = z.infer<
  typeof listMintedMilestonesResponseSchema
>;
