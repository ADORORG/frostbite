// @vitest-environment jsdom

import { ScenesProvider } from "@ador/scenes/react";
import { defineGame } from "@ador/shared/games";
import { mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import { homeRailCopy } from "../src/domain/home-rail-copy.ts";
import { GamesRail } from "../src/ui/games-rail.tsx";
import { noGames } from "../src/ui/states.tsx";
import {
  bareGame,
  chains,
  coveredGame,
  embeddedGame,
} from "./support/template-game.ts";

const make = (...games: Parameters<typeof createGameCatalog>[0]) =>
  createGameCatalog(games, chains).list();
const rail = (games: ReturnType<typeof make>) =>
  mount(
    <ScenesProvider>
      <GamesRail games={games} />
    </ScenesProvider>,
  );
const clone = (id: string) =>
  defineGame({ ...embeddedGame, id, title: `Game ${id}` });

describe("the landing page's rail of games", () => {
  it("is a named band with a moving background, a link to every game, and a card for each of the first few", async () => {
    const container = await rail(make(embeddedGame, coveredGame));
    expect(container.querySelector("section#games")).not.toBeNull();
    expect(container.querySelector(".scene-backdrop")).not.toBeNull();
    expect(textOf(container)).toContain(homeRailCopy.summary);
    expect(container.querySelector(".home-rail__link")?.textContent).toBe(
      homeRailCopy.link(2),
    );
    expect(container.querySelectorAll(".cover-card")).toHaveLength(2);
  });

  it("shows no more than the rail holds, however many games there are, and says how many there are in all", async () => {
    const games = make(
      ...["ga", "gb", "gc", "gd", "ge", "gf", "gg", "gh"].map(clone),
    );
    const container = await rail(games);
    expect(container.querySelectorAll(".cover-card")).toHaveLength(6);
    expect(container.querySelector(".home-rail__link")?.textContent).toBe(
      homeRailCopy.link(8),
    );
  });

  it("puts the games that can be played first", async () => {
    const container = await rail(make(bareGame, embeddedGame));
    const titles = [...container.querySelectorAll(".cover-card__title")].map(
      (el) => el.textContent,
    );
    expect(titles).toEqual([embeddedGame.title, bareGame.title]);
    expect(textOf(container)).toContain("Not playable yet");
  });

  it("lays a scene over a game's picture only when the game has no clip of its own", async () => {
    const container = await rail(make(embeddedGame, coveredGame));
    const cards = [...container.querySelectorAll(".cover-card")];
    const overlays = cards.map(
      (card) => card.querySelector(".scene-overlay") !== null,
    );
    // embeddedGame has no cover clip; coveredGame has one.
    expect(overlays).toEqual([true, false]);
  });

  it("says so, in the catalog's own words, when there are no games", async () => {
    const container = await rail([]);
    expect(textOf(container)).toContain(noGames.title);
    expect(textOf(container)).toContain(noGames.body);
    expect(container.querySelector(".cover-grid")).toBeNull();
    expect(container.querySelector(".home-rail__link")?.textContent).toBe(
      homeRailCopy.link(0),
    );
  });

  it("says a single game in the singular", () => {
    expect(homeRailCopy.link(1)).toBe("See the game");
  });
});
