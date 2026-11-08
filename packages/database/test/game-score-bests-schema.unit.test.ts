import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { gameScoreBests } from "../src/schema/game-score-bests.ts";

describe("the best scores kept for each game, player and period", () => {
  const config = getTableConfig(gameScoreBests);

  it("is one row per game, period and player, with a board index in the order a board reads", () => {
    expect(config.primaryKeys[0]?.columns.map((c) => c.name)).toEqual([
      "game_id",
      "window_kind",
      "window_start",
      "user_id",
    ]);
    expect(config.indexes.map((i) => i.config.name)).toEqual([
      "game_score_bests_board_idx",
    ]);
  });

  it("knows only the periods a board is kept for, and no negative score", () => {
    expect(config.checks.map((c) => c.name).sort()).toEqual([
      "game_score_bests_kind_known",
      "game_score_bests_not_negative",
    ]);
  });
});
