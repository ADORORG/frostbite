import "./zod-config.ts";
import { z } from "zod";

import {
  errorCodeSchema,
  gameChannel,
  jsonValueSchema,
  milestoneStatusSchema,
  playerIdentitySchema,
  playerInfoSchema,
  protocolVersion,
  toastMaxLength,
  walletInfoSchema,
} from "./protocol-values.ts";

// The values the protocol is built from (its channel and version, JSON, error codes, who the player is, a milestone's status
// and a wallet) are in protocol-values.ts; they are re-exported here, so this stays the one place a game imports them from.
export * from "./protocol-values.ts";

const timestamp = z.iso.datetime({ offset: true });
const empty = z.object({}).strict();

// A run's seed is 32 bits, the same as a run record's.
export const runSeedMax = 4_294_967_295;
export const runUnavailableReasons = [
  "not-supported",
  "signed-out",
  "too-many-open-runs",
] as const;
export const runRefusalReasons = [
  "already-submitted",
  "expired",
  "stale",
  "unknown-run",
] as const;

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
  // Asks the platform to open its wallet chooser. The game never handles the wallet: it learns the outcome from the
  // `wallet.changed` event (or `wallet.get`), and a player who closes the chooser changes nothing.
  "wallet.connect": {
    params: empty,
    result: z
      .object({
        status: z.enum(["already-connected", "requested", "unavailable"]),
      })
      .strict(),
  },
  // Asks the platform for a run of the game: a seed to play it from, and one right to submit its record. Needs the
  // `run:submit` capability. A player who is not signed in, a game the platform cannot replay, and a player with too many
  // runs open are answered `unavailable`, with why; the game plays on and its milestones stay self-reported.
  "run.start": {
    params: empty,
    result: z.discriminatedUnion("status", [
      z
        .object({
          expiresAt: timestamp,
          runId: z.string().min(1).max(64),
          seed: z.number().int().min(0).max(runSeedMax),
          status: z.literal("started"),
        })
        .strict(),
      z
        .object({
          reason: z.enum(runUnavailableReasons),
          status: z.literal("unavailable"),
        })
        .strict(),
    ]),
  },
  // Hands the platform the record of a run it issued (`@ador/game-sdk/run-record`). The platform replays it under the
  // game's published rules: `verified` (and which milestones that earned), `rejected` (with why; the run is spent), or
  // `refused` (nothing was replayed). One record per run.
  "run.submit": {
    params: z
      .object({ record: jsonValueSchema, runId: z.string().min(1).max(64) })
      .strict(),
    result: z.discriminatedUnion("status", [
      z
        .object({
          earned: z.array(z.string().max(64)),
          status: z.literal("verified"),
        })
        .strict(),
      z
        .object({
          reason: z.string().min(1).max(64),
          status: z.literal("rejected"),
        })
        .strict(),
      z
        .object({
          reason: z.enum(runRefusalReasons),
          status: z.literal("refused"),
        })
        .strict(),
    ]),
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
  {
    "run.start": "run:submit",
    "run.submit": "run:submit",
    "wallet.connect": "wallet",
    "wallet.get": "wallet",
  };
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
