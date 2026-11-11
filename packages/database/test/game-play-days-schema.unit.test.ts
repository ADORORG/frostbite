import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { gamePlayDays } from "../src/schema/game-play-days.ts";

describe("the runs started in each game on each day", () => {
  const config = getTableConfig(gamePlayDays);

  it("is one row per game and day, holding a count and no player", () => {
    expect(config.primaryKeys[0]?.columns.map((c) => c.name)).toEqual([
      "game_id",
      "day",
    ]);
    expect(config.columns.map((c) => c.name).sort()).toEqual([
      "day",
      "game_id",
      "plays",
    ]);
    expect(config.foreignKeys).toHaveLength(0);
  });

  it("holds only a count above zero", () => {
    expect(config.checks.map((c) => c.name)).toEqual([
      "game_play_days_plays_positive",
    ]);
  });
});
