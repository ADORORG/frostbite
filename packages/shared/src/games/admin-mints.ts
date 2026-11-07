import { z } from "zod";

import { chainRefSchema } from "../chain/chain-ref.ts";
import { gameIdSchema } from "./manifest.ts";

// What staff see of a game's mints and of the platform's fee on them. Amounts are whole units of the chain's smallest denomination, as
// decimal text: JSON has no integer wide enough for a sum of them.
const unitsSchema = z.string().regex(/^(?:0|[1-9][0-9]{0,18})$/u);

// How many mints one page of a game's list holds.
export const gameMintsPageSize = 20;

// A page's end, as the page that came before gives it: the completion time of the last mint on it and that mint's id.
export const mintCursorPattern =
  /^\d{4}-\d{2}-\d{2}T[0-9:.]{8,16}Z~[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const listGameMintsInputSchema = z
  .object({
    // Where the next page starts, as the previous page gave it; absent for the first.
    after: z.string().regex(mintCursorPattern).optional(),
    gameId: gameIdSchema,
  })
  .strict();
export const listGameMintsResponseSchema = z
  .object({
    mints: z
      .array(
        z
          .object({
            claimId: z.uuid(),
            completedAt: z.iso.datetime({ offset: true }),
            milestoneId: z.string().min(1).max(64),
            platformFeeUnits: unitsSchema,
            transactionId: z.string().min(1).max(128).nullable(),
            wallet: z.string().min(1).max(256),
          })
          .strict(),
      )
      .max(gameMintsPageSize),
    next: z.string().regex(mintCursorPattern).nullable(),
    totals: z
      .object({
        completed: z.number().int().nonnegative(),
        feesAccruedUnits: unitsSchema,
        inProgress: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

// The totals of every game that declares rewards, for the list of them.
export const listGameMintTotalsInputSchema = z.object({}).strict();
export const listGameMintTotalsResponseSchema = z
  .object({
    games: z
      .array(
        z
          .object({
            completed: z.number().int().nonnegative(),
            feesAccruedUnits: unitsSchema,
            gameId: gameIdSchema,
            inProgress: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

const feeSettingSchema = z
  .object({
    changedAt: z.iso.datetime({ offset: true }),
    // The name of who set it; none when that account is gone.
    changedBy: z.string().min(1).max(256).nullable(),
    feeUnits: unitsSchema,
    treasury: z.string().min(1).max(256),
  })
  .strict();

// The platform's fee on a milestone claim, a chain at a time: the one in force (none until one is set) and the settings before it.
export const getPlatformFeeInputSchema = z.object({}).strict();
export const getPlatformFeeResponseSchema = z
  .object({
    chains: z
      .array(
        z
          .object({
            chain: chainRefSchema,
            current: feeSettingSchema.nullable(),
            history: z.array(feeSettingSchema).max(20),
            // The most the fee may be set to, by policy.
            maximumFeeUnits: unitsSchema,
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

// The fee and the address it is paid to are set together: one cannot change without the other being stated.
export const setPlatformFeeInputSchema = z
  .object({
    chain: chainRefSchema,
    feeUnits: unitsSchema,
    treasury: z.string().trim().min(1).max(256),
  })
  .strict();
export const platformFeeRefusals = [
  "above-maximum",
  "below-minimum-output",
  "chain-unavailable",
  "invalid-address",
  "unknown-chain",
] as const;
export const setPlatformFeeResponseSchema = z.discriminatedUnion("status", [
  z.object({ setting: feeSettingSchema, status: z.literal("saved") }).strict(),
  z
    .object({
      // The limit that was crossed, for the two refusals that have one.
      limitUnits: unitsSchema.optional(),
      reason: z.enum(platformFeeRefusals),
      status: z.literal("refused"),
    })
    .strict(),
]);

export const gameAdminMintRoutes = {
  mints: {
    method: "GET",
    operationId: "listGameMints",
    path: "/api/v1/game-admin/mints",
  },
  mintTotals: {
    method: "GET",
    operationId: "listGameMintTotals",
    path: "/api/v1/game-admin/mint-totals",
  },
  platformFee: {
    method: "GET",
    operationId: "getPlatformFee",
    path: "/api/v1/game-admin/platform-fee",
  },
  setPlatformFee: {
    method: "POST",
    operationId: "setPlatformFee",
    path: "/api/v1/game-admin/platform-fee",
  },
} as const;

export type GetPlatformFeeResponse = z.infer<
  typeof getPlatformFeeResponseSchema
>;
export type ListGameMintsInput = z.infer<typeof listGameMintsInputSchema>;
export type ListGameMintsResponse = z.infer<typeof listGameMintsResponseSchema>;
export type ListGameMintTotalsResponse = z.infer<
  typeof listGameMintTotalsResponseSchema
>;
export type SetPlatformFeeInput = z.infer<typeof setPlatformFeeInputSchema>;
export type SetPlatformFeeResponse = z.infer<
  typeof setPlatformFeeResponseSchema
>;
