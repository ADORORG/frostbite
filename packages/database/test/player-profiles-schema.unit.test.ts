import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { playerProfiles } from "../src/schema/player-profiles.ts";

describe("the player profiles table", () => {
  const config = getTableConfig(playerProfiles);

  it("is one row per player, with the name kept unique on its lower case", () => {
    const columns = config.columns.map(({ name }) => name);
    expect(columns).toEqual([
      "user_id",
      "name",
      "name_key",
      "avatar",
      "visible",
      "name_changed_at",
      "created_at",
      "updated_at",
    ]);
    expect(config.columns.find(({ name }) => name === "user_id")?.primary).toBe(
      true,
    );
    expect(
      config.columns.find(({ name }) => name === "name_key")?.isUnique,
    ).toBe(true);
  });

  it("refuses a name that is not plain, is not bounded, or does not match its key", () => {
    expect(config.checks.map(({ name }) => name).sort()).toEqual([
      "player_profiles_changed_after_created",
      "player_profiles_name_bounded",
      "player_profiles_name_key_is_lower",
      "player_profiles_name_plain",
    ]);
  });
});
