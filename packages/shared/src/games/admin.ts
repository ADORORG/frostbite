import { z } from "zod";

import {
  gameAdminStepSchema,
  gameAdminTransactionSchema,
} from "./admin-step.ts";
import { gameIdSchema } from "./manifest.ts";

export * from "./admin-step.ts";

// Staff administration of a game's rewards contract: the capability, the pages, and the routes (ADR-018 Amendment 3). The
// capability is granted by the authorization policy to the `staff` role, so "any admin may pause" is the policy and not a
// check in this feature.
export const gameAdminCapability = "game:administer";
export const gameAdminPath = "/admin/games";
export const gameAdminDetailPath = "/admin/games/[gameId]";
export const gameAdminNavigationLabel = "Game rewards";
export const gameAdminHref = (gameId: string) => `${gameAdminPath}/${gameId}`;

// What staff may do. On a game with a contract: define a milestone (once; its claim limit comes from the manifest, so staff supply
// only its drawing), pause or resume claims. Before it has one: publish a template (once, for every game, at an address staff
// choose) and create the game's contract from the published templates.
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
  z
    .object({
      maxDrawingBytes: z.number().int().positive().max(1_048_576),
      operation: z.literal("deploy"),
    })
    .strict(),
  z
    .object({
      // Where on the chain the code is published, in the chain's own notation.
      address: z.string().trim().min(1).max(128),
      operation: z.literal("publish-template"),
      templateId: z.string().trim().min(1).max(64),
      templateVersion: z.string().trim().min(1).max(64),
    })
    .strict(),
]);

export const startGameAdminStepInputSchema = z
  .object({
    action: gameAdminActionSchema,
    // The output holding the game's auth token ("txid:vout"), for a chain whose steps must present it.
    authTokenOutput: z.string().trim().min(1).max(128).optional(),
    // The game the step is for; none when it publishes a template.
    gameId: gameIdSchema.nullable(),
    // The address of the wallet staff will sign with; the platform parses it for the game's chain.
    wallet: z.string().trim().min(1).max(256),
  })
  .strict()
  .refine(
    ({ action, gameId }) =>
      (action.operation === "publish-template") === (gameId === null),
    "A template is published for no game; every other step is for one.",
  );
export const gameAdminStartRefusals = [
  "address-taken",
  "already-created",
  "already-defined",
  "already-published",
  "bad-drawing",
  "could-not-build",
  "not-administered",
  "template-not-published",
  "unavailable",
  "unknown-template",
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
  .object({
    // The game's contract once the step that created it completed; none until then.
    contract: z
      .object({
        address: z.string().min(1).max(128),
        maxDrawingBytes: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    // The most a new contract may be created to accept, in bytes.
    drawingCeiling: z.number().int().positive(),
    steps: z.array(gameAdminStepSchema).max(500),
    // Whether both templates a game's contract is made from have been published.
    templatesReady: z.boolean(),
  })
  .strict();

// The templates the platform may publish, which are published and where, and the steps that publish them.
export const listGameAdminTemplatesInputSchema = z.object({}).strict();
export const listGameAdminTemplatesResponseSchema = z
  .object({
    published: z
      .array(
        z
          .object({
            address: z.string().min(1).max(128),
            publishedAt: z.iso.datetime({ offset: true }),
            templateRef: z.string().min(1).max(130),
          })
          .strict(),
      )
      .max(100),
    publishable: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            version: z.string().min(1).max(64),
          })
          .strict(),
      )
      .max(100),
    steps: z.array(gameAdminStepSchema).max(500),
  })
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
  templates: {
    method: "POST",
    operationId: "listGameAdminTemplates",
    path: "/api/v1/game-admin/templates",
  },
} as const;

export type GameAdminAction = z.infer<typeof gameAdminActionSchema>;
export type ListGameAdminTemplatesInput = z.infer<
  typeof listGameAdminTemplatesInputSchema
>;
export type ListGameAdminTemplatesResponse = z.infer<
  typeof listGameAdminTemplatesResponseSchema
>;
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
