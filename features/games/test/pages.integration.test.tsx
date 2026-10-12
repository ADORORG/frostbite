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
    expect(markup).toContain("v0.3.0");
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

  it("lays a game the platform plays out as a title line, a bar, the stage, then small cards in a row", async () => {
    const markup = await render(
      [embeddedGame],
      "/games/[slug]",
      "embedded-game",
    );
    const at = (text: string) => markup.indexOf(text);
    // One line for the name and its small facts, before everything else.
    expect(markup).toContain('class="arcade-section arcade-section--stage"');
    expect(markup).toMatch(
      /arcade-stage-title">Embedded game<\/h2><div class="arcade-stage-meta"><span>v1\.0\.0<\/span>/u,
    );
    expect(at("arcade-stage-title")).toBeLessThan(at("arcade-stage__bar"));
    expect(at("arcade-stage__bar")).toBeLessThan(at("<iframe"));
    expect(at("<iframe")).toBeLessThan(at("arcade-info-row"));
    // The rest is small cards after the game, not panels before it.
    for (const card of ["Your milestones", "About", "What it asks for"])
      expect(at(`aria-label="${card}"`)).toBeGreaterThan(at("<iframe"));
    expect(markup).not.toContain("arcade-panel");
    // The digest lives in About, and there is no second milestone list of declarations.
    expect(markup).toContain("Declarations digest:");
    expect(markup.match(/aria-label="Milestones of this game"/gu)).toHaveLength(
      1,
    );
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
