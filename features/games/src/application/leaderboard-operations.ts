import type { HttpOperation } from "@frostbite/http";
import type { HttpCachePolicy } from "@frostbite/http/cache";
import { failure, unauthenticated } from "@frostbite/http/outcome";
import {
  getLeaderboardInputSchema,
  getLeaderboardResponseSchema,
  getLeaderboardRoute,
  getMyRankInputSchema,
  getMyRankResponseSchema,
  getMyRankRoute,
  leaderboardSize,
  type GetLeaderboardInput,
  type GetLeaderboardResponse,
  type GetMyRankInput,
  type GetMyRankResponse,
  type LeaderboardWindow,
} from "@frostbite/shared/games";

// The reads a board needs, as the games feature sees them; the database-backed answer is made in `leaderboard-runtime.ts`.
export interface Leaderboards {
  mine(
    gameId: string,
    window: LeaderboardWindow,
    userId: string,
  ): Promise<{ readonly rank: number; readonly score: number } | null>;
  top(
    gameId: string,
    window: LeaderboardWindow,
  ): Promise<{
    readonly endsAt: Date | null;
    readonly entries: GetLeaderboardResponse["entries"];
    readonly players: number;
  }>;
}

// A board is read by anyone, so a minute old is fine: a score that has just settled shows within a minute.
export const leaderboardCache = {
  kind: "max-age",
  seconds: 60,
} as const satisfies HttpCachePolicy;

const noBoard = "This game has no leaderboard.";

// The best verified scores of a game that the platform replays runs of. A game it does not replay has no board: "not found", not an empty
// one, so a board that can never fill is not shown as if it could.
export function createGetLeaderboardOperation(
  getBoards: () => Promise<Leaderboards>,
  scored: ReadonlySet<string>,
) {
  return {
    access: { kind: "public" },
    applicationErrors: ["not_found"],
    cache: leaderboardCache,
    execute: async (input) => {
      if (!scored.has(input.gameId)) return failure("not_found", noBoard);
      const board = await (await getBoards()).top(input.gameId, input.window);
      return {
        ok: true,
        value: {
          endsAt: board.endsAt?.toISOString() ?? null,
          entries: board.entries.slice(0, leaderboardSize),
          players: board.players,
        },
      } as const;
    },
    idempotency: "none",
    input: "query",
    inputSchema: getLeaderboardInputSchema,
    outputSchema: getLeaderboardResponseSchema,
    ...getLeaderboardRoute,
  } satisfies HttpOperation<GetLeaderboardInput, GetLeaderboardResponse>;
}

// Where the signed-in player stands, from the session and never from the request, so nobody can ask about another player.
export function createGetMyRankOperation(
  getBoards: () => Promise<Leaderboards>,
  scored: ReadonlySet<string>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["not_found", "unauthorized"],
    cache: { kind: "revalidate" },
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      if (!scored.has(input.gameId)) return failure("not_found", noBoard);
      const place = await (
        await getBoards()
      ).mine(input.gameId, input.window, context.actorUserId);
      return { ok: true, value: { place } } as const;
    },
    idempotency: "none",
    input: "query",
    inputSchema: getMyRankInputSchema,
    outputSchema: getMyRankResponseSchema,
    ...getMyRankRoute,
  } satisfies HttpOperation<GetMyRankInput, GetMyRankResponse>;
}
