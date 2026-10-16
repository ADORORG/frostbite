import { z } from "zod";

import {
  chainFamilyIdTextSchema,
  chainRefTextSchema,
} from "../chain/chain-ref.ts";
import { gameIdSchema } from "./manifest.ts";

// Staff administration of a game's rewards contract: the capability, the pages, and the routes (ADR-018 Amendment 3). The
// capability is granted by the authorization policy to the `staff` role, so "any admin may pause" is the policy and not a
// check in this feature.
export const gameAdminCapability = "game:administer";
export const gameAdminPath = "/admin/games";
export const gameAdminDetailPath = "/admin/games/[gameId]";
export const gameAdminNavigationLabel = "Game rewards";
export const gameAdminHref = (gameId: string) => `${gameAdminPath}/${gameId}`;

// What staff may do to a game's contract. A milestone is defined once; its claim limit comes from the manifest, so staff supply
// only its drawing.
export const gameAdminActionSchema = z.discriminatedUnion("operation", [
  z
    .object({
      drawing: z.string().min(1).max(262_144).optional(),
      milestoneId: gameIdSchema,
      operation: z.literal("define-milestone"),
    })
    .strict(),
  z
    .object({
      operation: z.literal("set-claims-paused"),
      paused: z.boolean(),
    })
    .strict(),
]);

// Where a step stands (the lifecycle's stages; a test keeps the lists equal).
export const gameAdminStepStates = [
  "awaiting-signature",
  "complete",
  "confirmed",
  "expired",
  "failed",
  "pending",
] as const;

// The transaction as it crosses the page: the one staff sign, and the same once signed. Plain text throughout.
export const gameAdminTransactionSchema = z
  .object({
    chain: chainRefTextSchema,
    family: chainFamilyIdTextSchema,
    format: z.string().trim().min(1).max(64),
    payload: z.string().min(1).max(262_144),
  })
  .strict();

// What staff are shown before signing: what the step does, on which contract, for what fee, until when.
export const gameAdminSummarySchema = z
  .object({
    chain: z.string().min(1).max(64),
    claimLimit: z.number().int().positive().optional(),
    contractId: z.string().min(1).max(128),
    drawing: z
      .object({
        bytes: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/u),
      })
      .strict()
      .optional(),
    expiresAt: z.iso.datetime({ offset: true }),
    fee: z
      .object({
        asset: z.string().min(1).max(128),
        baseUnits: z.string().regex(/^\d{1,40}$/u),
      })
      .strict(),
    milestoneId: gameIdSchema.optional(),
    paused: z.boolean().optional(),
  })
  .strict();

const person = z.string().min(1).max(200).nullable();

export const gameAdminStepSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    createdBy: person,
    failureReason: z.string().min(1).max(256).nullable(),
    gameId: gameIdSchema,
    id: z.uuid(),
    operation: z.enum(["define-milestone", "set-claims-paused"]),
    state: z.enum(gameAdminStepStates),
    submittedBy: person,
    summary: gameAdminSummarySchema,
    toSign: gameAdminTransactionSchema.nullable(),
    transactionId: z.string().min(1).max(128).nullable(),
  })
  .strict();

export const startGameAdminStepInputSchema = z
  .object({
    action: gameAdminActionSchema,
    // The output holding the game's auth token ("txid:vout"), for a chain whose steps must present it.
    authTokenOutput: z.string().trim().min(1).max(128).optional(),
    gameId: gameIdSchema,
    // The address of the wallet staff will sign with; the platform parses it for the game's chain.
    wallet: z.string().trim().min(1).max(256),
  })
  .strict();
export const gameAdminStartRefusals = [
  "already-defined",
  "bad-drawing",
  "could-not-build",
  "not-administered",
  "unavailable",
  "wrong-network",
] as const;
export const startGameAdminStepResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      resumed: z.boolean(),
      status: z.literal("started"),
      step: gameAdminStepSchema,
    })
    .strict(),
  z
    .object({
      // Why, in words for staff, where the platform can say (a drawing it refused, a chain that could not build).
      detail: z.string().min(1).max(512).optional(),
      reason: z.enum(gameAdminStartRefusals),
      status: z.literal("refused"),
    })
    .strict(),
]);

export const submitGameAdminStepInputSchema = z
  .object({ signed: gameAdminTransactionSchema, stepId: z.uuid() })
  .strict();
export const gameAdminSubmitRefusals = [
  "chain-unavailable",
  "expired",
  "invalid-signature",
  "not-awaiting-signature",
  "not-found",
] as const;
export const submitGameAdminStepResponseSchema = z.discriminatedUnion(
  "status",
  [
    z
      .object({ status: z.literal("submitted"), step: gameAdminStepSchema })
      .strict(),
    z
      .object({
        reason: z.enum(gameAdminSubmitRefusals),
        status: z.literal("refused"),
      })
      .strict(),
  ],
);

export const refreshGameAdminStepInputSchema = z
  .object({ stepId: z.uuid() })
  .strict();
export const refreshGameAdminStepResponseSchema = z.discriminatedUnion(
  "status",
  [
    z.object({ status: z.literal("ok"), step: gameAdminStepSchema }).strict(),
    z
      .object({
        reason: z.enum(["chain-unavailable", "not-found"]),
        status: z.literal("refused"),
      })
      .strict(),
  ],
);

export const listGameAdminStepsInputSchema = z
  .object({ gameId: gameIdSchema })
  .strict();
export const listGameAdminStepsResponseSchema = z
  .object({ steps: z.array(gameAdminStepSchema).max(500) })
  .strict();

export const gameAdminRoutes = {
  list: {
    method: "POST",
    operationId: "listGameAdminSteps",
    path: "/api/v1/game-admin/list",
  },
  refresh: {
    method: "POST",
    operationId: "refreshGameAdminStep",
    path: "/api/v1/game-admin/refresh",
  },
  start: {
    method: "POST",
    operationId: "startGameAdminStep",
    path: "/api/v1/game-admin/start",
  },
  submit: {
    method: "POST",
    operationId: "submitGameAdminStep",
    path: "/api/v1/game-admin/submit",
  },
} as const;

export type GameAdminAction = z.infer<typeof gameAdminActionSchema>;
export type GameAdminStep = z.infer<typeof gameAdminStepSchema>;
export type GameAdminStepState = (typeof gameAdminStepStates)[number];
export type GameAdminSummary = z.infer<typeof gameAdminSummarySchema>;
export type GameAdminTransaction = z.infer<typeof gameAdminTransactionSchema>;
export type ListGameAdminStepsInput = z.infer<
  typeof listGameAdminStepsInputSchema
>;
export type ListGameAdminStepsResponse = z.infer<
  typeof listGameAdminStepsResponseSchema
>;
export type RefreshGameAdminStepInput = z.infer<
  typeof refreshGameAdminStepInputSchema
>;
export type RefreshGameAdminStepResponse = z.infer<
  typeof refreshGameAdminStepResponseSchema
>;
export type StartGameAdminStepInput = z.infer<
  typeof startGameAdminStepInputSchema
>;
export type StartGameAdminStepResponse = z.infer<
  typeof startGameAdminStepResponseSchema
>;
export type SubmitGameAdminStepInput = z.infer<
  typeof submitGameAdminStepInputSchema
>;
export type SubmitGameAdminStepResponse = z.infer<
  typeof submitGameAdminStepResponseSchema
>;
