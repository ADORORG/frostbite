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
  method: "GET",
  operationId: "listMintedMilestones",
  path: "/api/v1/games/milestones/minted",
} as const;

// The kinds of picture a minted milestone is shown as. The chain serves whatever its item says it is; only these are shown, and only
// through an image tag, which cannot run what a drawing holds.
export const mintedPictureContentTypes = ["image/svg+xml"] as const;

// The picture of one of the player's minted milestones, as the chain serves it for the item the claim minted. It is a file, not a
// JSON answer: a page shows it with an image tag pointed at `mintedPictureHref`, which a browser can keep. A picture that cannot be
// shown is a "not found" whose `reason` says why, never a broken image.
export const mintedPictureUnavailableReasons = [
  "chain-unavailable",
  "no-picture",
  "not-found",
] as const;
export const getMintedPictureInputSchema = z
  .object({ claimId: z.uuid() })
  .strict();
export const getMintedPictureFileSchema = z
  .object({
    bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
    contentType: z.enum(mintedPictureContentTypes),
  })
  .strict();
export const getMintedPictureRoute = {
  method: "GET",
  operationId: "getMintedPicture",
  path: "/api/v1/games/milestones/picture",
} as const;

// Where a minted milestone's picture is read: an address, so a browser can ask once and keep it.
export const mintedPictureHref = (claimId: string) =>
  `${getMintedPictureRoute.path}?${new URLSearchParams({ claimId }).toString()}`;

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
export type GetMintedPictureFile = z.infer<typeof getMintedPictureFileSchema>;
