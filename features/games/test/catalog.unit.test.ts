import { gameManifestHash } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import {
  createGameCatalog,
  gameCapabilityLabels,
} from "../src/domain/catalog.ts";
import {
  bareGame,
  chains,
  rewardsGame,
  coveredGame,
  embeddedGame,
  replayedGame,
  templateGame,
  walletGame,
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
        { available: false, id: "wallet", label: gameCapabilityLabels.wallet },
        {
          available: false,
          id: "run:submit",
          label: gameCapabilityLabels["run:submit"],
        },
      ],
      claimable: false,
      cover: null,
      description: "A game written from the template.",
      embedSrc: null,
      hash: gameManifestHash(templateGame),
      id: "template-game",
      milestones: templateGame.milestones,
      scored: false,
      networkLabel: "Bitcoin signet",
      playable: true,
      playUrl: "https://play.example.test/template",
      scene: null,
      summary: "Shows what a registered game looks like.",
      tags: ["arcade"],
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

  it("grants a capability only when the host answers it and the platform plays the game itself", () => {
    const granted = (game: Parameters<typeof createGameCatalog>[0][number]) =>
      createGameCatalog([game], chains)
        .list()[0]
        ?.capabilities.map(({ available, id }) => [id, available]);
    expect(granted(walletGame)).toEqual([
      ["wallet", true],
      ["balance:read", false],
    ]);
    // The same declaration on a game that runs elsewhere is never granted: the host is not in the way.
    expect(granted({ ...templateGame, capabilities: ["wallet"] })).toEqual([
      ["wallet", false],
    ]);
  });

  it("lists the milestone:claim capability as granted to a game the platform plays itself, because the host answers it", () => {
    const claimable = createGameCatalog(
      [
        {
          ...embeddedGame,
          capabilities: ["milestone:claim"],
          rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
        },
      ],
      chains,
    ).list()[0];
    expect(claimable?.capabilities).toEqual([
      {
        available: true,
        id: "milestone:claim",
        label: "Start a claim for a milestone the player earned",
      },
    ]);
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

describe("the scene on a game's card", () => {
  it("is null when the manifest leaves it to the platform, and the manifest's own when it names one", () => {
    const named = { ...embeddedGame, id: "named-scene", scene: "runner" };
    const catalog = createGameCatalog([embeddedGame, named], chains);
    expect(catalog.find("embedded-game")?.scene).toBeNull();
    expect(catalog.find("named-scene")?.scene).toBe("runner");
  });

  it("is refused, naming the game, when it is not a scene the platform has", () => {
    expect(() =>
      createGameCatalog(
        [{ ...embeddedGame, id: "odd-scene", scene: "no-such-scene" }],
        chains,
      ),
    ).toThrow(
      'Game "odd-scene" names a scene the platform does not have: "no-such-scene".',
    );
  });
});

describe("whether a game's milestones can be claimed", () => {
  it("is so for a game the platform plays itself that declares rewards, and for no other", () => {
    const claimable = (game: Parameters<typeof createGameCatalog>[0][number]) =>
      createGameCatalog([game], chains).list()[0]?.claimable;
    expect(claimable(rewardsGame)).toBe(true);
    expect(claimable(embeddedGame)).toBe(false);
    expect(claimable(templateGame)).toBe(false);
    // The same declaration on a game that runs elsewhere is never offered: the platform is not in its way.
    expect(claimable({ ...rewardsGame, launch: templateGame.launch })).toBe(
      false,
    );
  });
});

describe("whether a game has a leaderboard", () => {
  it("is so for a game the platform replays, and for no other", () => {
    const scored = (game: Parameters<typeof createGameCatalog>[0][number]) =>
      createGameCatalog([game], chains).list()[0]?.scored;
    expect(scored(replayedGame)).toBe(true);
    expect(scored(rewardsGame)).toBe(false);
    expect(scored(templateGame)).toBe(false);
  });
});
