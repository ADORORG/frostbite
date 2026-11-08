import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { authUsers, gameShares } from "../src/index.ts";

describe("game share schema", () => {
  const config = getTableConfig(gameShares);

  it("belongs to a player and goes with the player", () => {
    expect(
      config.foreignKeys.map((key) => [
        getTableName(key.reference().foreignTable),
        key.onDelete,
      ]),
    ).toEqual([[getTableName(authUsers), "cascade"]]);
  });

  it("keeps each kind to the columns it needs, and a revoke after the creation", () => {
    expect(config.checks.map(({ name }) => name)).toEqual([
      "game_shares_shape",
      "game_shares_revoked_after_created",
    ]);
  });

  it("allows one live share per player and thing, for each kind", () => {
    const live = config.indexes.filter(({ config: index }) => index.unique);
    expect(live.map(({ config: index }) => index.name)).toEqual([
      "game_shares_live_milestones_idx",
      "game_shares_live_milestone_idx",
      "game_shares_live_score_idx",
    ]);
    for (const { config: index } of live) expect(index.where).toBeDefined();
  });

  it("keeps who shared out of what is shown: the link is a random identifier of its own", () => {
    const names = config.columns.map(({ name }) => name);
    expect(names).toEqual([
      "id",
      "user_id",
      "kind",
      "game_id",
      "milestone_id",
      "score",
      "verification",
      "created_at",
      "revoked_at",
    ]);
    expect(config.columns.find(({ name }) => name === "id")?.primary).toBe(
      true,
    );
  });
});
