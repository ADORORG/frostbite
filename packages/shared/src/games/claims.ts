import { z } from "zod";

import {
  chainFamilyIdTextSchema,
  chainRefTextSchema,
} from "../chain/chain-ref.ts";
import { gameIdSchema } from "./manifest.ts";

// A player's claim of a milestone on chain, as the page is told of it. Nothing here is chain-specific beyond the opaque
// transaction the wallet signs; amounts are decimal text, because JSON cannot carry a bigint.

// Where a claim stands (the SDK's `claimStates`; a test keeps the lists equal).
export const gameClaimStates = [
  "awaiting-signature",
  "pending",
  "claimed",
  "complete",
  "failed",
  "expired",
] as const;
export const gameClaimStateSchema = z.enum(gameClaimStates);

// A transaction as it crosses the page: the one the wallet is asked to sign, and the same once signed. Plain text throughout
// (a brand is a transform, which the API's OpenAPI document cannot describe); the platform brands it on the way in.
export const gameClaimTransactionSchema = z
  .object({
    chain: chainRefTextSchema,
    family: chainFamilyIdTextSchema,
    format: z.string().trim().min(1).max(64),
    payload: z.string().min(1).max(65_536),
  })
  .strict();

// Why a claim cannot start (the SDK's `claimUnavailableReasons` less `signed-out`, which is the missing session; a test
// keeps them equal).
export const gameClaimUnavailableReasons = [
  "limit-reached",
  "no-wallet",
  "not-claimable",
  "not-earned",
  "not-supported",
  "unavailable",
  "wrong-network",
] as const;

// What the player is shown before signing: which milestone, from which contract, to whom, for what fee, until when.
export const gameClaimSummarySchema = z
  .object({
    chain: z.string().min(1).max(64),
    contractId: z.string().min(1).max(128),
    expiresAt: z.iso.datetime({ offset: true }),
    fee: z
      .object({
        asset: z.string().min(1).max(128),
        baseUnits: z.string().regex(/^\d{1,40}$/u),
      })
      .strict(),
    milestoneId: gameIdSchema,
    recipient: z.string().min(1).max(256),
  })
  .strict();

export const gameClaimSchema = z
  .object({
    failureReason: z.string().min(1).max(256).nullable(),
    gameId: gameIdSchema,
    id: z.uuid(),
    milestoneId: gameIdSchema,
    state: gameClaimStateSchema,
    summary: gameClaimSummarySchema,
    // The transaction for the wallet to sign, while the wallet is still to be asked; otherwise nothing.
    toSign: gameClaimTransactionSchema.nullable(),
    transactionId: z.string().min(1).max(128).nullable(),
  })
  .strict();

export const startGameClaimInputSchema = z
  .object({
    gameId: gameIdSchema,
    milestoneId: gameIdSchema,
    // The address of the wallet that will sign, as the page's connected wallet gives it. The platform parses it for the game's
    // chain and refuses what is not an address there.
    wallet: z.string().trim().min(1).max(256),
  })
  .strict();
export const startGameClaimResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      claim: gameClaimSchema,
      resumed: z.boolean(),
      status: z.literal("started"),
    })
    .strict(),
  z
    .object({
      reason: z.enum(gameClaimUnavailableReasons),
      status: z.literal("unavailable"),
    })
    .strict(),
]);

export const submitGameClaimInputSchema = z
  .object({ claimId: z.uuid(), signed: gameClaimTransactionSchema })
  .strict();
export const gameClaimRefusalReasons = [
  "chain-unavailable",
  "expired",
  "invalid-signature",
  "not-awaiting-signature",
  "not-found",
] as const;
export const submitGameClaimResponseSchema = z.discriminatedUnion("status", [
  z.object({ claim: gameClaimSchema, status: z.literal("submitted") }).strict(),
  z
    .object({
      reason: z.enum(gameClaimRefusalReasons),
      status: z.literal("refused"),
    })
    .strict(),
]);

export const refreshGameClaimInputSchema = z
  .object({ claimId: z.uuid() })
  .strict();
export const refreshGameClaimResponseSchema = z.discriminatedUnion("status", [
  z.object({ claim: gameClaimSchema, status: z.literal("ok") }).strict(),
  z
    .object({
      reason: z.enum(["chain-unavailable", "not-found"]),
      status: z.literal("refused"),
    })
    .strict(),
]);

export const listGameClaimsInputSchema = z
  .object({ gameId: gameIdSchema })
  .strict();
export const listGameClaimsResponseSchema = z
  .object({ claims: z.array(gameClaimSchema).max(500) })
  .strict();

export const startGameClaimRoute = {
  method: "POST",
  operationId: "startGameClaim",
  path: "/api/v1/games/claims/start",
} as const;
export const submitGameClaimRoute = {
  method: "POST",
  operationId: "submitGameClaim",
  path: "/api/v1/games/claims/submit",
} as const;
export const refreshGameClaimRoute = {
  method: "POST",
  operationId: "refreshGameClaim",
  path: "/api/v1/games/claims/refresh",
} as const;
export const listGameClaimsRoute = {
  method: "POST",
  operationId: "listGameClaims",
  path: "/api/v1/games/claims/list",
} as const;

export type GameClaim = z.infer<typeof gameClaimSchema>;
export type GameClaimState = z.infer<typeof gameClaimStateSchema>;
export type GameClaimUnavailableReason =
  (typeof gameClaimUnavailableReasons)[number];
export type StartGameClaimInput = z.infer<typeof startGameClaimInputSchema>;
export type StartGameClaimResponse = z.infer<
  typeof startGameClaimResponseSchema
>;
export type SubmitGameClaimInput = z.infer<typeof submitGameClaimInputSchema>;
export type SubmitGameClaimResponse = z.infer<
  typeof submitGameClaimResponseSchema
>;
export type RefreshGameClaimInput = z.infer<typeof refreshGameClaimInputSchema>;
export type RefreshGameClaimResponse = z.infer<
  typeof refreshGameClaimResponseSchema
>;
export type ListGameClaimsInput = z.infer<typeof listGameClaimsInputSchema>;
export type ListGameClaimsResponse = z.infer<
  typeof listGameClaimsResponseSchema
>;
