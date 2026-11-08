import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { gameMilestoneMintTotals } from "../src/schema/game-claims.ts";

describe("the counts kept for each milestone", () => {
  it("are one row per game and milestone, and never negative", () => {
    const config = getTableConfig(gameMilestoneMintTotals);
    expect(config.primaryKeys[0]?.columns.map((c) => c.name)).toEqual([
      "game_id",
      "milestone_id",
    ]);
    expect(config.checks.map((c) => c.name)).toContain(
      "game_milestone_mint_totals_not_negative",
    );
  });
});
