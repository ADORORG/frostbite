import { z } from "zod";

import { gameIdSchema } from "./manifest.ts";

// The most a seed can be: the run record carries a 32-bit seed (`@ador/game-sdk/run-record`).
export const gameRunSeedMax = 4_294_967_295;

// Why a game that is signed in cannot be given a run right now: the platform holds no replay verifier for it, or the player
// already has as many runs open as the platform allows.
export const gameRunUnavailableReasons = [
  "not-supported",
  "too-many-open-runs",
] as const;

// A signed-in player asks for a run of a game. The platform answers with a run it will accept one record for, and the
// seed the game must play it from, or says why it cannot: a game that can start a run is a game the platform can replay.
export const startGameRunInputSchema = z
  .object({ gameId: gameIdSchema })
  .strict();
export const startGameRunResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      expiresAt: z.iso.datetime({ offset: true }),
      runId: z.uuid(),
      seed: z.number().int().min(0).max(gameRunSeedMax),
      status: z.literal("started"),
    })
    .strict(),
  z
    .object({
      reason: z.enum(gameRunUnavailableReasons),
      status: z.literal("unavailable"),
    })
    .strict(),
]);

// The record of a run, as the game made it. It is untrusted JSON: the platform parses it with the run record's own
// schema and replays it; nothing here says what it contains.
export const submitGameRunInputSchema = z
  .object({ gameId: gameIdSchema, record: z.json(), runId: z.uuid() })
  .strict();

// Why a run cannot be settled at all: it was settled already, it ran out of time, the game's rules changed after it was
// issued, or there is no such run for this player and game.
export const gameRunRefusalReasons = [
  "already-submitted",
  "expired",
  "stale",
  "unknown-run",
] as const;

// What the platform found. `verified`: the replay established the run, and `earned` is the milestones it earned that the
// game's manifest declares replay-verifiable; they are on the player's account already. `rejected`: the record did not
// hold, with the reason, and the run is spent. `refused`: nothing was replayed.
export const submitGameRunResponseSchema = z.discriminatedUnion("status", [
  z
    .object({ earned: z.array(gameIdSchema), status: z.literal("verified") })
    .strict(),
  z
    .object({
      reason: z.string().min(1).max(64),
      status: z.literal("rejected"),
    })
    .strict(),
  z
    .object({
      reason: z.enum(gameRunRefusalReasons),
      status: z.literal("refused"),
    })
    .strict(),
]);

export const startGameRunRoute = {
  method: "POST",
  operationId: "startGameRun",
  path: "/api/v1/games/runs/start",
} as const;

export const submitGameRunRoute = {
  method: "POST",
  operationId: "submitGameRun",
  path: "/api/v1/games/runs/submit",
} as const;

export type StartGameRunInput = z.infer<typeof startGameRunInputSchema>;
export type StartGameRunResponse = z.infer<typeof startGameRunResponseSchema>;
export type SubmitGameRunInput = z.infer<typeof submitGameRunInputSchema>;
export type SubmitGameRunResponse = z.infer<typeof submitGameRunResponseSchema>;
