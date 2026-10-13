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
  "permission_denied",
  "rate_limited",
  "too_large",
  "unavailable",
  "unknown_method",
  "unknown_milestone",
] as const;
export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// Who the game is told the player is: an opaque id for this game alone. `local` is made in this browser and
// kept here; `account` is made for the signed-in player's account and is the same on every device. It changes
// once, from local to account, when a player signs in, and the game is told (`player.changed`). It is random:
// nothing in it identifies the person, and another game is given a different one.
export const playerIdentitySchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/u),
    kind: z.enum(["local", "account"]),
  })
  .strict();
export type PlayerIdentity = z.infer<typeof playerIdentitySchema>;

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

// The wallet a player has connected, as far as a game that declared the `wallet` capability may see it: the
// public address and the network name. Never a key, a signature, a wallet object or a transaction.
export const walletInfoSchema = z
  .object({
    address: z.string().regex(/^[A-Za-z0-9]{14,90}$/u),
    network: z.string().regex(/^[a-z0-9-]{1,32}$/u),
  })
  .strict();
export type WalletInfo = z.infer<typeof walletInfoSchema>;

// A message a game may ask the platform to show the player. Plain text, kept short.
export const toastMaxLength = 140;

const timestamp = z.iso.datetime({ offset: true });
const empty = z.object({}).strict();

// Each method: what the game sends, and what it gets back.
export const methods = {
  "capabilities.get": {
    params: empty,
    result: z
      .object({
        events: z.array(z.string()),
        granted: z.array(z.string()),
        limits: z
          .object({
            progressMaxBytes: z.number().int().positive(),
            toastMaxLength: z.number().int().positive(),
          })
          .strict(),
        methods: z.array(z.string()),
        protocolVersion: z.literal(protocolVersion),
      })
      .strict(),
  },
  "milestones.list": {
    params: empty,
    result: z.object({ milestones: z.array(milestoneStatusSchema) }).strict(),
  },
  "milestones.counts": {
    params: empty,
    result: z
      .object({
        counts: z.array(
          z
            .object({
              // The total the game last reported toward `target`, or null for a milestone with no target.
              current: z.number().int().min(0).nullable(),
              // How many times it has been earned: 0 while locked, 1 for one earned once, more for a repeatable one.
              count: z.number().int().min(0),
              id: z.string(),
              // The most a repeatable milestone is counted, or null for one earned once.
              max: z.number().int().positive().nullable(),
              target: z.number().int().positive().nullable(),
            })
            .strict(),
        ),
      })
      .strict(),
  },
  "milestones.progress": {
    params: z
      .object({
        current: z.number().int().min(0).max(1_000_000),
        id: z.string().min(1).max(64),
      })
      .strict(),
    result: z
      .object({
        // The total the platform holds: the larger of this report and what it had, never above the target.
        current: z.number().int().min(0),
        status: z.enum(["locked", "unlocked"]),
        target: z.number().int().positive(),
        unlockedAt: timestamp.nullable(),
      })
      .strict(),
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
  "player.identity": { params: empty, result: playerIdentitySchema },
  "player.info": { params: empty, result: playerInfoSchema },
  "progress.load": {
    params: empty,
    result: z.object({ state: jsonValueSchema.nullable() }).strict(),
  },
  "progress.save": {
    params: z.object({ state: jsonValueSchema }).strict(),
    result: z.object({ savedAt: timestamp }).strict(),
  },
  "ui.toast": {
    params: z
      .object({ message: z.string().trim().min(1).max(toastMaxLength) })
      .strict(),
    result: z.object({ shown: z.boolean() }).strict(),
  },
  "wallet.get": {
    params: empty,
    result: z.object({ wallet: walletInfoSchema.nullable() }).strict(),
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
// The manifest capability a method needs before the host answers it. A method not listed needs none.
export const requiredCapability: Readonly<Partial<Record<MethodName, string>>> =
  { "wallet.get": "wallet" };
export type Params<Name extends MethodName> = z.infer<
  (typeof methods)[Name]["params"]
>;
export type Result<Name extends MethodName> = z.infer<
  (typeof methods)[Name]["result"]
>;

// What the page tells a game without being asked. Each is delivered only to a game that has called `ready`
// (and, for the wallet, declared the capability). A message in this shape is not a response, so a game built
// on an older SDK ignores it.
export const events = {
  "fullscreen.changed": z.object({ active: z.boolean() }).strict(),
  "player.changed": playerIdentitySchema,
  "lifecycle.changed": z
    .object({ state: z.enum(["active", "paused"]) })
    .strict(),
  "wallet.changed": z.object({ wallet: walletInfoSchema.nullable() }).strict(),
} as const;
export type EventName = keyof typeof events;
export const eventNames = Object.keys(events) as EventName[];
export type EventData<Name extends EventName> = z.infer<(typeof events)[Name]>;
// The capability a game must have declared to be sent an event. An event not listed needs none.
export const requiredEventCapability: Readonly<
  Partial<Record<EventName, string>>
> = { "wallet.changed": "wallet" };

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

export const eventMessageSchema = z
  .object({
    channel: z.literal(gameChannel),
    data: z.unknown(),
    event: z.string().max(64),
    version: z.literal(protocolVersion),
  })
  .strict();
export type EventMessage = z.infer<typeof eventMessageSchema>;

export type Request = z.infer<typeof requestSchema>;
export type Response = z.infer<typeof responseSchema>;
