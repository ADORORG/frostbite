import { z } from "zod";

import { gameIdSchema } from "./manifest.ts";

// The page that frames a game tells the platform when a run was started in it, so the games being played most can be shown as hot. It is
// open to anyone (a visitor who is not signed in plays too) and names no one. A visitor over their allowance for the minute is answered
// 429 like any other caller, and the page ignores it: the start is simply not added.
export const recordGamePlayInputSchema = z
  .object({ gameId: gameIdSchema })
  .strict();
export const recordGamePlayResponseSchema = z
  .object({ counted: z.boolean() })
  .strict();
export type RecordGamePlayInput = z.infer<typeof recordGamePlayInputSchema>;
export type RecordGamePlayResponse = z.infer<
  typeof recordGamePlayResponseSchema
>;
export const recordGamePlayRoute = {
  method: "POST",
  operationId: "recordGamePlay",
  path: "/api/v1/games/play",
} as const;

// How hot a ranked game is, drawn as a meter of this many steps against the busiest game. Every page that draws the meter and the ranking
// that fills it read this one number.
export const heatLevels = 5;

// One ranked game as the pages see it: its place (1 is the busiest), its heat from 1 to `heatLevels`, and whether it is among the hot ones.
// The number of plays is not part of it: the pages show how hot a game is, not how many plays it has.
export const gameHeatSchema = z
  .object({
    gameId: gameIdSchema,
    heat: z.int().min(1).max(heatLevels),
    hot: z.boolean(),
    rank: z.int().min(1),
  })
  .strict();
export type GameHeat = z.infer<typeof gameHeatSchema>;
