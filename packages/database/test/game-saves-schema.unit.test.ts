import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { authUsers, gameMilestoneUnlocks, gameSaves } from "../src/index.ts";

describe("game save schema", () => {
  it("belongs to a player, one save per game, and goes with the player", () => {
    const config = getTableConfig(gameSaves);
    expect(config.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
      "user_id",
      "game_id",
    ]);
    expect(
      config.foreignKeys.map((key) => [
        getTableName(key.reference().foreignTable),
        key.onDelete,
      ]),
    ).toEqual([[getTableName(authUsers), "cascade"]]);
    expect(config.checks.map(({ name }) => name)).toEqual([
      "game_saves_progress_coherent",
      "game_saves_bytes_bounded",
    ]);
  });

  it("records a milestone once per player, game and milestone, as self-reported only", () => {
    const config = getTableConfig(gameMilestoneUnlocks);
    expect(config.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
      "user_id",
      "game_id",
      "milestone_id",
    ]);
    expect(config.checks.map(({ name }) => name)).toEqual([
      "game_milestone_verification_known",
    ]);
    expect(config.foreignKeys.map((key) => key.onDelete)).toEqual(["cascade"]);
  });
});
