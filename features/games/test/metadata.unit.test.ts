import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import {
  gameMetadata,
  gameShareImagePath,
  gameSitemapPaths,
  gamesIndexMetadata,
} from "../src/metadata.ts";
import {
  bareGame,
  chains,
  coveredGame,
  templateGame,
} from "./support/template-game.ts";

const catalog = createGameCatalog([templateGame, coveredGame], chains);

describe("a game's page metadata", () => {
  it("names the game and says what its own summary says", () => {
    expect(gameMetadata(catalog, "template-game")).toEqual({
      description: templateGame.summary,
      image: {
        alt: "Template game, a game in the arcade",
        path: "/games/template-game/share-image",
      },
      kind: "shared",
      title: "Template game",
    });
  });

  it("describes the picture with the cover's own words when the game has a cover", () => {
    const page = gameMetadata(catalog, "covered-game");
    expect(page.kind === "shared" && page.image?.alt).toBe(
      coveredGame.cover?.alt,
    );
  });

  it("says nothing about a game that is not registered, or no game at all", () => {
    expect(gameMetadata(catalog, "unknown-game")).toEqual({ kind: "private" });
    expect(gameMetadata(catalog, undefined)).toEqual({ kind: "private" });
  });

  it("keeps a summary of the longest length a manifest allows, whole", () => {
    const longest = "a".repeat(200);
    const long = createGameCatalog(
      [{ ...templateGame, summary: longest }],
      chains,
    );
    const page = gameMetadata(long, "template-game");
    expect(page.kind === "shared" && page.description).toBe(longest);
  });

  it("gives the picture the address the route serves", () => {
    expect(gameShareImagePath("frost-runner")).toBe(
      "/games/frost-runner/share-image",
    );
  });
});

describe("the games page's metadata", () => {
  it("is shared, with words that make no promise the arcade does not keep", () => {
    expect(gamesIndexMetadata).toMatchObject({
      kind: "shared",
      title: "Games",
    });
  });
});

describe("the games in the sitemap", () => {
  it("are the games page and each registered game", () => {
    expect(gameSitemapPaths(catalog)).toEqual([
      "/games",
      "/games/template-game",
      "/games/covered-game",
    ]);
  });

  it("are none when no game is registered", () => {
    expect(gameSitemapPaths(createGameCatalog([], chains))).toEqual([]);
    expect(gameSitemapPaths(createGameCatalog([bareGame], chains))).toContain(
      "/games/bare-game",
    );
  });
});
