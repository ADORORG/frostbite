import type {
  GetLeaderboardResponse,
  GetMyRankResponse,
  LeaderboardWindow,
} from "@frostbite/shared/games";
import { useEffect, useState } from "react";

import {
  createLeaderboardApi,
  type LeaderboardApi,
} from "../client/leaderboard-api.ts";

export type LeaderboardState =
  | { readonly kind: "failed" }
  | { readonly kind: "loading" }
  | {
      readonly board: GetLeaderboardResponse;
      // The signed-in player's place, null when they have none, or when nobody is signed in (the board does not need to tell them apart).
      readonly kind: "ready";
      readonly place: GetMyRankResponse["place"];
    };

// One period of one game's board. Changing the period starts a new read; an answer to an earlier one is dropped. The player's own place
// is a separate, optional read: it failing (nobody signed in, or the platform unreachable) never costs the board.
export function useLeaderboard(
  gameId: string,
  window: LeaderboardWindow,
  api?: LeaderboardApi,
): LeaderboardState {
  // An answer is kept with the question it answers, so one for another game or period is simply not the current state.
  const asked = `${gameId}:${window}`;
  const [answer, setAnswer] = useState<{
    readonly asked: string;
    readonly state: LeaderboardState;
  } | null>(null);
  useEffect(() => {
    let current = true;
    const source = api ?? createLeaderboardApi();
    const keep = (state: LeaderboardState) =>
      current && setAnswer({ asked, state });
    Promise.all([
      source.board(gameId, window),
      source.mine(gameId, window).catch(() => null),
    ])
      .then(([board, place]) => keep({ board, kind: "ready", place }))
      .catch(() => keep({ kind: "failed" }));
    return () => {
      current = false;
    };
  }, [api, asked, gameId, window]);
  return answer?.asked === asked ? answer.state : { kind: "loading" };
}
