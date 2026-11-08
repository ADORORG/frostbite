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
export const createShareResponseSchema = z
  .object({ id: shareIdSchema, path: z.string().min(1).max(64) })
  .strict();
export type CreateShareResponse = z.infer<typeof createShareResponseSchema>;
export const createShareRoute = {
  method: "POST",
  operationId: "createShare",
  path: "/api/v1/games/shares",
} as const;

export const revokeShareInputSchema = z.object({ id: shareIdSchema }).strict();
export const revokeShareResponseSchema = z.object({}).strict();
export const revokeShareRoute = {
  method: "POST",
  operationId: "revokeShare",
  path: "/api/v1/games/shares/revoke",
} as const;

// Where a shared page is: a path on the platform, which the caller makes absolute on the public address.
export const sharePath = (id: string) => `/s/${id}`;
