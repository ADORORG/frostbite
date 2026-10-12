import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { gameSyncRoute } from "@ador/shared/games";
import { createGamesEntrypoint } from "../src/entrypoint.tsx";
import { createGamesFeature } from "../src/registration.ts";
import {
  bareGame,
  chains,
  embeddedGame,
  templateGame,
} from "./support/template-game.ts";

async function render(
  games: Parameters<typeof createGamesEntrypoint>[0],
  path: "/games" | "/games/[slug]",
  slug?: string,
) {
  const page = createGamesEntrypoint(games, chains).pages?.find(
    (candidate) => candidate.path === path,
  );
  if (page === undefined) throw new Error(`No page ${path}`);
  return renderToStaticMarkup(
    await page.render({
      actorUserId: null,
      navigation: [],
      params: slug === undefined ? {} : { slug },
    }),
  );
}

describe("the games index", () => {
  it("says plainly that no game is registered", async () => {
    const markup = await render([], "/games");
    expect(markup).toContain("No games online");
    expect(markup).toContain("not presented as playable");
    expect(markup).not.toContain("Registered games");
  });

  it("lists each game with whether it can be played, and a link to it", async () => {
    const markup = await render([templateGame, bareGame], "/games");
    expect(markup).toContain("Template game");
    expect(markup).toContain('href="/games/template-game"');
    expect(markup).toContain('href="/games/bare-game"');
    expect(markup).toContain("Playable");
    expect(markup).toContain("Not playable yet");
    expect(markup).toContain("Bitcoin signet");
  });

  it("lists a game the platform plays itself as playable", async () => {
    const markup = await render([embeddedGame], "/games");
    expect(markup).toContain("Playable");
    expect(markup).not.toContain("Not playable yet");
  });
});

describe("a game's page", () => {
  it("shows a playable game with its play link, its declarations and a note that they are only declarations", async () => {
    const markup = await render(
      [templateGame],
      "/games/[slug]",
      "template-game",
    );
    expect(markup).toContain("Version 0.3.0");
    expect(markup).toContain('href="https://play.example.test/template"');
    expect(markup).toContain("Play Template game");
    expect(markup).toContain(
      "It opens at play.example.test, not on this site.",
    );
    expect(markup).toContain("Connect the player&#x27;s wallet");
    expect(markup).toContain("These are requests only");
    expect(markup).toContain("First level");
    expect(markup).toContain("How it is earned: Finish the first level.");
    expect(markup).toContain("Once per player");
    expect(markup).toContain("Can be earned again");
    expect(markup).toContain("Earning and claiming them on chain");
    expect(markup).toContain("cannot verify what happens");
    expect(markup).toContain("Declarations digest:");
  });

  it("says a game with no play address cannot be opened, and asks for nothing", async () => {
    const markup = await render([bareGame], "/games/[slug]", "bare-game");
    expect(markup).toContain("Not playable yet");
    expect(markup).toContain("no play address yet");
    expect(markup).not.toContain("Play Bare game");
    expect(markup).toContain("does not ask the platform for anything");
    expect(markup).not.toContain("Milestones of this game");
    expect(markup).not.toContain("<p></p>");
  });

  it("shows a game the platform plays itself in a frame that is sandboxed to scripts only, and offers no link away", async () => {
    const markup = await render(
      [embeddedGame],
      "/games/[slug]",
      "embedded-game",
    );
    expect(markup).toContain("This game is played on this page.");
    expect(markup).toContain('data-game-src="/play/embedded-game/index.html"');
    expect(markup).toContain('sandbox="allow-scripts"');
    // Started by the page once the host is listening, never by the server's markup, so the game's first
    // message cannot arrive before anyone is there to answer it.
    expect(markup).not.toMatch(/<iframe[^>]* src=/u);
    expect(markup).not.toContain("allow-same-origin");
    expect(markup).toContain("Playable");
    expect(markup).not.toContain("not on this site");
    expect(markup).toContain("Your milestones");
  });

  it("separates an address that cannot be a game from one that is only unknown", async () => {
    const invalid = await render(
      [templateGame],
      "/games/[slug]",
      "Bad Address",
    );
    const unknown = await render(
      [templateGame],
      "/games/[slug]",
      "no-such-game",
    );
    expect(invalid).toContain("Invalid route");
    expect(invalid).not.toContain("Bad Address");
    expect(unknown).toContain("Record not published");
    expect(unknown).toContain("No published game matches");
    expect(unknown).toContain("no-such-game");
    expect(unknown).not.toContain("Template game");
  });

  it("treats a missing address as invalid", async () => {
    expect(await render([templateGame], "/games/[slug]")).toContain(
      "Invalid route",
    );
  });
});

describe("the games feature registration", () => {
  it("declares its pages, its navigation item and no provider needs, and loads pages that match", async () => {
    const feature = createGamesFeature([templateGame], chains);
    expect(feature.manifest).toMatchObject({
      id: "games",
      navigation: [{ area: "main", href: "/games", label: "Games" }],
      requiredProviderCapabilities: [],
      routes: [gameSyncRoute],
    });
    const entrypoint = await feature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["games"],
    });
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual(
      feature.manifest.pages.map(({ path }) => path),
    );
  });
});
