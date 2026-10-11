import "./zod-config.ts";
import { z } from "zod";

// The one conversation between a game and the page that hosts it. Versioned, every message validated on both
// sides. A game cannot do anything the platform has not put in this list.
export const gameChannel = "ador-game";
export const protocolVersion = 1;

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

// Anything the game saves is plain JSON: what survives being copied between frames and stored as text.
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().refine(Number.isFinite, "Numbers must be finite."),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const errorCodes = [
  "invalid_request",
  "not_ready",
  "rate_limited",
  "too_large",
  "unavailable",
  "unknown_method",
  "unknown_milestone",
] as const;
export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const playerInfoSchema = z
  .object({ signedIn: z.boolean(), walletConnected: z.boolean() })
  .strict();
export type PlayerInfo = z.infer<typeof playerInfoSchema>;

// How a claim was established. Only `self-reported` exists today: the game said so. A later level (a run the
// platform re-checked) adds a value here; nothing that is stored or minted needs to change shape.
export const verificationLevels = ["self-reported"] as const;
export const verificationSchema = z.enum(verificationLevels);

export const milestoneStatusSchema = z
  .object({
    claimPolicy: z.enum(["once", "repeatable"]),
    criteria: z.string(),
    description: z.string(),
    id: z.string(),
    status: z.enum(["locked", "unlocked"]),
    title: z.string(),
    unlockedAt: z.iso.datetime({ offset: true }).nullable(),
    verification: verificationSchema.nullable(),
  })
  .strict();
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

const timestamp = z.iso.datetime({ offset: true });
const empty = z.object({}).strict();

// Each method: what the game sends, and what it gets back.
export const methods = {
  "milestones.list": {
    params: empty,
    result: z.object({ milestones: z.array(milestoneStatusSchema) }).strict(),
  },
  "milestones.unlock": {
    params: z.object({ id: z.string().min(1).max(64) }).strict(),
    result: z
      .object({
        status: z.enum(["unlocked", "already-unlocked"]),
        unlockedAt: timestamp,
      })
      .strict(),
  },
  "player.info": { params: empty, result: playerInfoSchema },
  "progress.load": {
    params: empty,
    result: z.object({ state: jsonValueSchema.nullable() }).strict(),
  },
  "progress.save": {
    params: z.object({ state: jsonValueSchema }).strict(),
    result: z.object({ savedAt: timestamp }).strict(),
  },
  ready: {
    params: z.object({ sdkVersion: z.number().int().positive() }).strict(),
    result: z
      .object({
        gameId: z.string(),
        limits: z
          .object({ progressMaxBytes: z.number().int().positive() })
          .strict(),
        player: playerInfoSchema,
        protocolVersion: z.literal(protocolVersion),
      })
      .strict(),
  },
} as const;

export type MethodName = keyof typeof methods;
export const methodNames = Object.keys(methods) as MethodName[];
export type Params<Name extends MethodName> = z.infer<
  (typeof methods)[Name]["params"]
>;
export type Result<Name extends MethodName> = z.infer<
  (typeof methods)[Name]["result"]
>;

const envelope = {
  channel: z.literal(gameChannel),
  id: z.string().min(1).max(64),
  version: z.literal(protocolVersion),
};

// What a game sends. The parameters are checked against the method's own schema once the method is known.
export const requestSchema = z
  .object({ ...envelope, method: z.string().max(64), params: z.unknown() })
  .strict();

export const responseSchema = z.discriminatedUnion("ok", [
  z.object({ ...envelope, ok: z.literal(true), result: z.unknown() }).strict(),
  z
    .object({
      ...envelope,
      error: z
        .object({ code: errorCodeSchema, message: z.string().max(256) })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export type Request = z.infer<typeof requestSchema>;
export type Response = z.infer<typeof responseSchema>;
