import { defineGame } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import { heatById, hotFirst } from "../src/domain/heat-order.ts";
import { chains, embeddedGame } from "./support/template-game.ts";

const games = createGameCatalog(
  ["ga", "gb", "gc", "gd"].map((id) => defineGame({ ...embeddedGame, id })),
  chains,
).list();
const ids = (list: readonly { readonly id: string }[]) =>
  list.map(({ id }) => id);
const heat = (gameId: string, rank: number) => ({
  gameId,
  heat: 3,
  hot: rank <= 3,
  rank,
});

describe("the games with the hot ones first", () => {
  it("puts the ranked games first in their rank and keeps the others in the order they came", () => {
    expect(ids(hotFirst(games, [heat("gc", 1), heat("ga", 2)]))).toEqual([
      "gc",
      "ga",
      "gb",
      "gd",
    ]);
  });

  it("leaves the list as it was when nothing is ranked, and ignores a ranking of a game that is not there", () => {
    expect(ids(hotFirst(games, []))).toEqual(["ga", "gb", "gc", "gd"]);
    expect(ids(hotFirst(games, [heat("gone", 1)]))).toEqual([
      "ga",
      "gb",
      "gc",
      "gd",
    ]);
  });

  it("does not change the list it was given", () => {
    hotFirst(games, [heat("gd", 1)]);
    expect(ids(games)).toEqual(["ga", "gb", "gc", "gd"]);
  });

  it("finds a game's heat by its name", () => {
    expect(heatById([heat("gc", 1)]).get("gc")?.rank).toBe(1);
    expect(heatById([heat("gc", 1)]).get("ga")).toBeUndefined();
  });
});
