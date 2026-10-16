import { WalletProvider } from "@ador/wallet/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  gameSyncRoute,
  listGameClaimsRoute,
  refreshGameClaimRoute,
  startGameClaimRoute,
  startGameRunRoute,
  submitGameClaimRoute,
  submitGameRunRoute,
} from "@ador/shared/games";
import { createGamesEntrypoint } from "../src/entrypoint.tsx";
import { createGamesFeature } from "../src/registration.ts";
import {
  bareGame,
  chains,
  coveredGame,
  embeddedGame,
  templateGame,
  claimsConfig,
  runsConfig,
  walletConfig,
  walletGame,
} from "./support/template-game.ts";

async function render(
  games: Parameters<typeof createGamesEntrypoint>[0],
  path: "/games" | "/games/[slug]",
  slug?: string,
) {
  const page = createGamesEntrypoint(
    games,
    chains,
    walletConfig,
    runsConfig,
    claimsConfig,
  ).pages?.find((candidate) => candidate.path === path);
  if (page === undefined) throw new Error(`No page ${path}`);
  // The app's layout provides the wallet connection above every page; a page rendered alone needs the same.
  return renderToStaticMarkup(
    <WalletProvider network="signet">
      {await page.render({
        actorUserId: null,
        navigation: [],
        params: slug === undefined ? {} : { slug },
      })}
    </WalletProvider>,
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

  it("shows each game as a preview in a numbered wall, with a stand-in where there is no cover", async () => {
    const markup = await render([embeddedGame, bareGame], "/games");
    expect(markup).toContain("arcade-section--wall");
    expect(markup).toContain("arcade-ticker");
    expect(markup).toContain("Insert coin");
    expect(markup).toContain(">01<");
    expect(markup).toContain(">02<");
    expect(markup).toContain("arcade-preview__stand-in");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("2 milestones");
    expect(markup).not.toContain("0 milestones");
  });

  it("shows a cover's picture with its words, and starts no clip on the server", async () => {
    const markup = await render([coveredGame], "/games");
    expect(markup).toContain('src="/play/covered-game/assets/cover.webp"');
    expect(markup).toContain('alt="A tower of blocks, one tap from falling."');
    expect(markup).not.toContain("<video");
    expect(markup).not.toContain("arcade-preview__stand-in");
  });

  it("offers a way in named for the game, and says Play now only for one that can be played", async () => {
    const markup = await render([embeddedGame, bareGame], "/games");
    expect(markup).toContain('aria-label="View Embedded game"');
    expect(markup).toContain("Play now");
    expect(markup).toContain("View game");
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
    expect(markup).toContain("See the address of the wallet");
    expect(markup).toContain("Not available yet");
    expect(markup).toContain("declaration only");
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
    expect(markup).not.toContain("not on this site");
    expect(markup).toContain("Your milestones");
  });

  it("lays a game the platform plays out as the title in the bar, the stage, then a dock of sections", async () => {
    const markup = await render(
      [embeddedGame],
      "/games/[slug]",
      "embedded-game",
    );
    const at = (text: string) => markup.indexOf(text);
    expect(markup).toContain('class="arcade-section arcade-section--stage"');
    // The name and its small facts are in the bar over the game, not on a line of their own above it.
    expect(markup).toMatch(
      /arcade-stage__title">Embedded game<\/h2><span class="arcade-stage__facts"><span>v1\.0\.0<\/span>/u,
    );
    expect(markup).not.toContain("arcade-stage-head");
    // The way back to the list is in the bar too, before the title.
    expect(markup).toMatch(
      /arcade-stage__bar"><a class="arcade-stage__back" href="\/games">← All games<\/a><h2/u,
    );
    expect(at("arcade-stage__bar")).toBeLessThan(at("<iframe"));
    expect(at("<iframe")).toBeLessThan(at("arcade-dock"));
    // Everything else is a section of the dock after the game, closed until asked for.
    for (const section of ["Your milestones", "About", "What it asks for"])
      expect(at(`aria-label="${section}"`)).toBeGreaterThan(at("<iframe"));
    expect(markup.match(/class="arcade-dock__panel" hidden=""/gu)).toHaveLength(
      3,
    );
    expect(markup).not.toContain("arcade-panel");
    expect(markup).toContain("Declarations digest:");
    expect(markup.match(/aria-label="Milestones of this game"/gu)).toHaveLength(
      1,
    );
  });

  it("keeps a title line and small cards for a game that is played somewhere else", async () => {
    const markup = await render(
      [templateGame],
      "/games/[slug]",
      "template-game",
    );
    expect(markup).toContain("arcade-stage-head");
    expect(markup).toContain("Not playable yet");
    expect(markup).toContain(">All games<");
    expect(markup).not.toContain("arcade-dock");
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

describe("a game that asks to see the player's wallet", () => {
  it("shows what it asks for as available, and what is only declared as not, and gives it a wallet section", async () => {
    const markup = await render([walletGame], "/games/[slug]", "wallet-game");
    expect(markup).toContain("See the address of the wallet the player");
    expect(markup).toContain("Available");
    expect(markup).toContain("Read the player&#x27;s balance");
    expect(markup).toContain("Not available yet");
    expect(markup).toContain("Your wallet");
    expect(markup).toContain("Connect a wallet");
    expect(markup).not.toContain("/sign-in");
  });

  it("is given no wallet section when the game did not ask, and says it asks for nothing", async () => {
    const markup = await render(
      [embeddedGame],
      "/games/[slug]",
      "embedded-game",
    );
    expect(markup).not.toContain("Your wallet");
    expect(markup).toContain("does not ask the platform for anything");
  });
});

describe("the games feature registration", () => {
  it("declares its pages, its navigation item and no provider needs, and loads pages that match", async () => {
    const feature = createGamesFeature(
      [templateGame],
      chains,
      walletConfig,
      runsConfig,
      claimsConfig,
    );
    expect(feature.manifest).toMatchObject({
      id: "games",
      navigation: [{ area: "main", href: "/games", label: "Games" }],
      requiredProviderCapabilities: [],
      routes: [
        gameSyncRoute,
        startGameRunRoute,
        submitGameRunRoute,
        startGameClaimRoute,
        submitGameClaimRoute,
        refreshGameClaimRoute,
        listGameClaimsRoute,
      ],
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
