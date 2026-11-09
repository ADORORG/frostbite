import { z } from "zod";

import {
  profileAvatarSchema,
  profileNameSchema,
} from "../profiles/contracts.ts";
import { gameIdSchema } from "./manifest.ts";

// A game's leaderboard: the best scores the platform itself verified by replaying the run, for all time, this month or this week (UTC).
// Anyone may read it. A row names a player only when they switched their public profile on; otherwise it is "a player", with no
// identifier, so a row cannot be traced to an account.
export const leaderboardWindows = ["all", "month", "week"] as const;
export const leaderboardWindowSchema = z.enum(leaderboardWindows);
export type LeaderboardWindow = z.infer<typeof leaderboardWindowSchema>;
export const leaderboardSize = 25;

export const leaderboardEntrySchema = z
  .object({
    achievedAt: z.iso.datetime({ offset: true }),
    profile: z
      .object({ avatar: profileAvatarSchema, name: profileNameSchema })
      .strict()
      .nullable(),
    rank: z.int().min(1),
    score: z.int().min(0),
  })
  .strict();
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const getLeaderboardInputSchema = z
  .object({ gameId: gameIdSchema, window: leaderboardWindowSchema })
  .strict();
export const getLeaderboardResponseSchema = z
  .object({
    entries: z.array(leaderboardEntrySchema).max(leaderboardSize),
    // When this period ends and the next begins; null for all time.
    endsAt: z.iso.datetime({ offset: true }).nullable(),
    players: z.int().min(0),
  })
  .strict();
export type GetLeaderboardInput = z.infer<typeof getLeaderboardInputSchema>;
export type GetLeaderboardResponse = z.infer<
  typeof getLeaderboardResponseSchema
>;
export const getLeaderboardRoute = {
  method: "GET",
  operationId: "getLeaderboard",
  path: "/api/v1/games/leaderboard",
} as const;

// The signed-in player's own place in a period, or null when they have no verified score in it.
export const getMyRankInputSchema = getLeaderboardInputSchema;
export const getMyRankResponseSchema = z
  .object({
    place: z
      .object({ rank: z.int().min(1), score: z.int().min(0) })
      .strict()
      .nullable(),
  })
  .strict();
export type GetMyRankInput = GetLeaderboardInput;
export type GetMyRankResponse = z.infer<typeof getMyRankResponseSchema>;
export const getMyRankRoute = {
  method: "GET",
  operationId: "getMyRank",
  path: "/api/v1/games/leaderboard/me",
} as const;
