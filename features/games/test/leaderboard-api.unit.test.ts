import type { FetchLike } from "@frostbite/client-http";
import { describe, expect, it, vi } from "vitest";

import { createLeaderboardApi } from "../src/client/leaderboard-api.ts";

const answering = (body: object, status = 200) =>
  vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status }));

describe("the leaderboard routes as the page reaches them", () => {
  it("asks with a GET of the game and the period, and gives the place of the signed-in player", async () => {
    const board = answering({ endsAt: null, entries: [], players: 0 });
    await createLeaderboardApi(board).board("arcade", "week");
    expect(String(board.mock.calls[0]?.[0])).toBe(
      "/api/v1/games/leaderboard?gameId=arcade&window=week",
    );
    expect(board.mock.calls[0]?.[1]?.method).toBe("GET");
    const mine = answering({ place: { rank: 2, score: 90 } });
    expect(await createLeaderboardApi(mine).mine("arcade", "all")).toEqual({
      rank: 2,
      score: 90,
    });
    expect(String(mine.mock.calls[0]?.[0])).toBe(
      "/api/v1/games/leaderboard/me?gameId=arcade&window=all",
    );
  });

  it("refuses an answer that is not the contract's shape, and throws what the requester throws", async () => {
    await expect(
      createLeaderboardApi(answering({ entries: [{ extra: 1 }] })).board(
        "arcade",
        "all",
      ),
    ).rejects.toThrow();
    await expect(
      createLeaderboardApi(answering({}, 401)).mine("arcade", "all"),
    ).rejects.toThrow();
  });
});
