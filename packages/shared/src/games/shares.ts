import { z } from "zod";

import { gameIdSchema } from "./manifest.ts";

// What a player can share: a milestone they hold, the case of milestones they have minted, or a score. The request names the thing,
// never how it is known: the platform looks the level up on the account (a milestone) or calls it self-reported (a score), so a
// request cannot ask for a stronger label than the account has.
export const shareRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("milestones") }).strict(),
  z
    .object({
      gameId: gameIdSchema,
      kind: z.literal("milestone"),
      milestoneId: gameIdSchema,
    })
    .strict(),
  z
    .object({
      gameId: gameIdSchema,
      kind: z.literal("score"),
      score: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
]);
export type ShareRequest = z.infer<typeof shareRequestSchema>;

export const shareVerifications = ["replay-verified", "self-reported"] as const;
export type ShareVerification = (typeof shareVerifications)[number];

// A link is a random identifier; anything else is refused before the database is asked.
export const shareIdSchema = z.uuid();

export const createShareInputSchema = shareRequestSchema;
// Why a share could not be made: the same few reasons the service gives, as a value the page can say in words.
export const shareUnavailableReasons = [
  "not-earned",
  "unknown-game",
  "unknown-milestone",
] as const;
export type ShareUnavailableReason = (typeof shareUnavailableReasons)[number];
export const createShareResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      id: shareIdSchema,
      path: z.string().min(1).max(64),
      status: z.literal("shared"),
    })
    .strict(),
  z
    .object({
      reason: z.enum(shareUnavailableReasons),
      status: z.literal("unavailable"),
    })
    .strict(),
]);
export type CreateShareInput = z.infer<typeof createShareInputSchema>;
export type CreateShareResponse = z.infer<typeof createShareResponseSchema>;
export const createShareRoute = {
  method: "POST",
  operationId: "createShare",
  path: "/api/v1/games/shares",
} as const;

export const revokeShareInputSchema = z.object({ id: shareIdSchema }).strict();
// Whether a live share of the player's own was ended; a share that is not theirs, or is already ended, answers the same.
export const revokeShareResponseSchema = z
  .object({ revoked: z.boolean() })
  .strict();
export type RevokeShareInput = z.infer<typeof revokeShareInputSchema>;
export type RevokeShareResponse = z.infer<typeof revokeShareResponseSchema>;
export const revokeShareRoute = {
  method: "POST",
  operationId: "revokeShare",
  path: "/api/v1/games/shares/revoke",
} as const;

// A shared page, and the picture its link preview shows. The platform path is one source for the page registration, the manifest and
// the browser tests; `id` is the link's identifier.
export const sharedPagePath = "/s/[id]";
export const sharePath = (id: string): `/${string}` => `/s/${id}`;
export const shareImagePath = (id: string): `/${string}` =>
  `${sharePath(id)}/share-image`;
