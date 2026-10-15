import { z } from "zod";

import { gameIdSchema } from "./manifest.ts";

// The most a seed can be: the run record carries a 32-bit seed (`@ador/game-sdk/run-record`).
export const gameRunSeedMax = 4_294_967_295;

// A signed-in player asks for a run of a game. The platform answers with a run it will accept one record for, and the
// seed the game must play it from: a game that can start a run is a game the platform can replay.
export const startGameRunInputSchema = z
  .object({ gameId: gameIdSchema })
  .strict();
export const startGameRunResponseSchema = z
  .object({
    expiresAt: z.iso.datetime({ offset: true }),
    runId: z.uuid(),
    seed: z.number().int().min(0).max(gameRunSeedMax),
  })
  .strict();

// The record of a run, as the game made it. It is untrusted JSON: the platform parses it with the run record's own
// schema and replays it; nothing here says what it contains.
export const submitGameRunInputSchema = z
  .object({ gameId: gameIdSchema, record: z.json(), runId: z.uuid() })
  .strict();

// What the platform found. `earned` is the milestones the replay established that the game's manifest declares
// replay-verifiable; they are already on the player's account when this is answered. A rejected record says why.
export const submitGameRunResponseSchema = z
  .object({
    earned: z.array(gameIdSchema),
    reason: z.string().nullable(),
    status: z.enum(["rejected", "verified"]),
  })
  .strict();

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
