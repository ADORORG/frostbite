import { gameManifestHash } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import {
  createGameCatalog,
  gameCapabilityLabels,
} from "../src/domain/catalog.ts";
import {
  bareGame,
  chains,
  coveredGame,
  embeddedGame,
  templateGame,
} from "./support/template-game.ts";

describe("the game catalog", () => {
  const catalog = createGameCatalog([templateGame, bareGame], chains);

  it("lists the games in the order they were registered", () => {
    expect(catalog.list().map(({ id }) => id)).toEqual([
      "template-game",
      "bare-game",
    ]);
    expect(createGameCatalog([], chains).list()).toEqual([]);
  });

  it("presents a game from its manifest alone", () => {
    expect(catalog.find("template-game")).toEqual({
      capabilities: [
        gameCapabilityLabels.wallet,
        gameCapabilityLabels["run:submit"],
      ],
      cover: null,
      description: "A game written from the template.",
      embedSrc: null,
      hash: gameManifestHash(templateGame),
      id: "template-game",
      milestones: templateGame.milestones,
      networkLabel: "Bitcoin signet",
      playable: true,
      playUrl: "https://play.example.test/template",
      summary: "Shows what a registered game looks like.",
      title: "Template game",
      version: "0.3.0",
    });
  });

  it("serves a game the platform plays itself from its own folder, with no external address", () => {
    expect(
      createGameCatalog([embeddedGame], chains).find("embedded-game"),
    ).toMatchObject({
      embedSrc: "/play/embedded-game/index.html",
      playable: true,
      playUrl: null,
    });
  });

  it("gives a cover as addresses the platform serves from the game's own folder, never as the file names alone", () => {
    expect(
      createGameCatalog([coveredGame], chains).find("covered-game")?.cover,
    ).toEqual({
      alt: "A tower of blocks, one tap from falling.",
      image: "/play/covered-game/assets/cover.webp",
      video: "/play/covered-game/assets/cover.mp4",
    });
    expect(
      createGameCatalog(
        [
          {
            ...coveredGame,
            cover: { alt: "Still only.", image: "cover.png", video: null },
          },
        ],
        chains,
      ).find("covered-game")?.cover,
    ).toEqual({
      alt: "Still only.",
      image: "/play/covered-game/assets/cover.png",
      video: null,
    });
  });

  it("has no play address for a game that is not configured, and names an unconfigured chain by its identifier", () => {
    expect(catalog.find("bare-game")).toMatchObject({
      networkLabel: "eip155:1",
      playable: false,
      playUrl: null,
    });
  });

  it("finds only registered games", () => {
    expect(catalog.find("missing-game")).toBeNull();
    expect(catalog.find(undefined)).toBeNull();
  });

  it("tells an identifier that could be a game's from one that cannot", () => {
    expect(catalog.isValidSlug("missing-game")).toBe(true);
    expect(catalog.isValidSlug("Missing")).toBe(false);
    expect(catalog.isValidSlug(undefined)).toBe(false);
    expect(catalog.isValidSlug("../admin")).toBe(false);
  });
});
