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

// The kinds of picture a minted milestone is shown as. The chain serves whatever its item says it is; only these are shown, and only
// through an image tag, which cannot run what a drawing holds.
export const mintedPictureContentTypes = ["image/svg+xml"] as const;

// The picture of one of the player's minted milestones, as the chain serves it for the item the claim minted. The bytes travel as
// base64 text, because JSON cannot carry them. A picture that cannot be shown is an answer with a reason, never a broken image.
export const mintedPictureUnavailableReasons = [
  "chain-unavailable",
  "no-picture",
  "not-found",
] as const;
export const getMintedPictureInputSchema = z
  .object({ claimId: z.uuid() })
  .strict();
export const getMintedPictureResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      contentType: z.enum(mintedPictureContentTypes),
      data: z.string().min(1).max(1_400_000),
      edition: z.number().int().positive(),
      status: z.literal("ok"),
    })
    .strict(),
  z
    .object({
      reason: z.enum(mintedPictureUnavailableReasons),
      status: z.literal("unavailable"),
    })
    .strict(),
]);
export const getMintedPictureRoute = {
  method: "POST",
  operationId: "getMintedPicture",
  path: "/api/v1/games/milestones/picture",
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
export type GetMintedPictureInput = z.infer<typeof getMintedPictureInputSchema>;
export type GetMintedPictureResponse = z.infer<
  typeof getMintedPictureResponseSchema
>;
