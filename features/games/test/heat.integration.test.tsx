// @vitest-environment jsdom

import { ScenesProvider } from "@frostbite/scenes/react";
import { defineGame, heatLevels, type GameHeat } from "@frostbite/shared/games";
import { mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import { emptyGameQuery } from "../src/domain/game-query.ts";
import { heatCopy } from "../src/domain/heat-copy.ts";
import { homeRailCopy } from "../src/domain/home-rail-copy.ts";
import { GamesBrowser } from "../src/ui/games-browser.tsx";
import { GamesRail } from "../src/ui/games-rail.tsx";
import { GamesWall } from "../src/ui/games-wall.tsx";
import { chains, embeddedGame } from "./support/template-game.ts";

const games = createGameCatalog(
  ["ga", "gb", "gc", "gd", "ge"].map((id) =>
    defineGame({ ...embeddedGame, id, title: `Game ${id}` }),
  ),
  chains,
).list();
const heat = (gameId: string, rank: number, level: number): GameHeat => ({
  gameId,
  heat: level,
  hot: rank <= 3,
  rank,
});
// Fifth is hottest, then the third, the fourth, the first and the second, so the order is neither the catalog's nor an alphabet's.
const ranking = [
  heat("ge", 1, 5),
  heat("gc", 2, 3),
  heat("gd", 3, 2),
  heat("ga", 4, 1),
];
const titles = (root: ParentNode) =>
  [...root.querySelectorAll(".cover-card__title")].map((t) => t.textContent);
const card = (root: ParentNode, id: string) =>
  [...root.querySelectorAll(".cover-card")].find(
    (el) =>
      el.querySelector(".cover-card__title")?.textContent === `Game ${id}`,
  );
const scene = (node: React.ReactNode) =>
  mount(<ScenesProvider>{node}</ScenesProvider>);

describe("the rail of games on the landing page, when games are hot", () => {
  it("leads with the hot games in their rank, under the hot title, with the rank on each", async () => {
    const container = await scene(<GamesRail games={games} hot={ranking} />);
    expect(titles(container).slice(0, 4)).toEqual([
      "Game ge",
      "Game gc",
      "Game gd",
      "Game ga",
    ]);
    expect(textOf(container)).toContain(heatCopy.rail.title);
    expect(textOf(container)).toContain(heatCopy.rail.summary);
    expect(textOf(container)).not.toContain(homeRailCopy.title);
    expect(
      [...container.querySelectorAll(".cover-card__rank")].map(
        (r) => r.textContent,
      ),
    ).toEqual(["01", "02", "03", "04"]);
  });

  it("is the plain rail, with no sticker or meter, when nothing is ranked", async () => {
    const container = await scene(<GamesRail games={games} />);
    expect(titles(container)).toEqual(games.map(({ title }) => title));
    expect(textOf(container)).toContain(homeRailCopy.summary);
    expect(container.querySelector(".hot-sticker")).toBeNull();
    expect(container.querySelector(".heat")).toBeNull();
    expect(container.querySelector(".cover-card__rank")).toBeNull();
  });

  it("keeps the plain title when the games ranked are not among those it shows", async () => {
    const container = await scene(
      <GamesRail games={games} hot={[heat("elsewhere", 1, 5)]} />,
    );
    expect(textOf(container)).toContain(homeRailCopy.summary);
    expect(container.querySelector(".hot-sticker")).toBeNull();
  });
});

describe("a card of a game that is ranked", () => {
  it("has the sticker and a lit rim only when the game is among the hot ones, and a meter whenever it is ranked", async () => {
    const container = await scene(
      <GamesWall games={games} hot={ranking} whole />,
    );
    const top = card(container, "ge");
    const fourth = card(container, "ga");
    const unranked = card(container, "gb");
    expect(top?.getAttribute("data-hot")).toBe("true");
    expect(top?.querySelector(".hot-sticker")?.textContent).toBe(heatCopy.hot);
    expect(fourth?.getAttribute("data-hot")).toBeNull();
    expect(fourth?.querySelector(".hot-sticker")).toBeNull();
    expect(fourth?.querySelector(".heat")).not.toBeNull();
    expect(unranked?.querySelector(".heat")).toBeNull();
    expect(unranked?.getAttribute("data-hot")).toBeNull();
  });

  it("draws the meter lit to the game's heat, with one name for a screen reader and the stage beside it", async () => {
    const container = await scene(
      <GamesWall games={games} hot={ranking} whole />,
    );
    const meter = card(container, "gc")?.querySelector('[role="img"]');
    expect(meter?.getAttribute("aria-label")).toBe(heatCopy.describe(3));
    expect(meter?.querySelectorAll("i")).toHaveLength(heatLevels);
    // The bars lit are the first three, from the left, so the meter rises with the heat.
    expect(
      [...(meter?.querySelectorAll("i") ?? [])].map((bar) =>
        bar.getAttribute("data-lit"),
      ),
    ).toEqual(["true", "true", "true", null, null]);
    expect(
      card(container, "gc")?.querySelector(".heat__word")?.textContent,
    ).toBe(heatCopy.stage(3));
    const blazing = card(container, "ge")?.querySelector('[role="img"]');
    expect(blazing?.querySelectorAll('i[data-lit="true"]')).toHaveLength(
      heatLevels,
    );
  });

  it("says a better word as the heat climbs, from the first to the last", () => {
    const words = Array.from({ length: heatLevels }, (_, i) =>
      heatCopy.stage(i + 1),
    );
    expect(new Set(words).size).toBe(heatLevels);
    expect(heatCopy.stage(0)).toBe(words[0]);
    expect(heatCopy.stage(heatLevels + 3)).toBe(words[heatLevels - 1]);
  });
});

describe("the games page with hot games", () => {
  const browser = (hot: readonly GameHeat[]) =>
    scene(<GamesBrowser games={games} hot={hot} initial={emptyGameQuery} />);

  it("puts the hot games first and numbers only the ranked, leaving the rest in the order they were registered", async () => {
    const container = await browser(ranking);
    expect(titles(container)).toEqual([
      "Game ge",
      "Game gc",
      "Game gd",
      "Game ga",
      "Game gb",
    ]);
    expect(
      card(container, "gb")?.querySelector(".cover-card__rank"),
    ).toBeNull();
    expect(
      card(container, "ge")?.querySelector(".cover-card__rank")?.textContent,
    ).toBe("01");
  });

  it("is the registered order, numbered by place as it always was, when nothing is ranked", async () => {
    const container = await browser([]);
    expect(titles(container)).toEqual(games.map(({ title }) => title));
    expect(
      [...container.querySelectorAll(".cover-card__rank")].map(
        (r) => r.textContent,
      ),
    ).toEqual(["01", "02", "03", "04", "05"]);
    expect(container.querySelector(".hot-sticker")).toBeNull();
  });
});
