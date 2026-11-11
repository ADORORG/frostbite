import { WalletProvider } from "@frostbite/wallet/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createShareRoute,
  gameSyncRoute,
  getGalleryPictureRoute,
  getLeaderboardRoute,
  getMyRankRoute,
  recordGamePlayRoute,
  getSharedPictureRoute,
  listGalleryMintsRoute,
  getMintedPictureRoute,
  listGameClaimsRoute,
  listMintedMilestonesRoute,
  myMilestonesPath,
  refreshGameClaimRoute,
  revokeShareRoute,
  startGameClaimRoute,
  startGameRunRoute,
  submitGameClaimRoute,
  submitGameRunRoute,
} from "@frostbite/shared/games";
import { createGamesEntrypoint } from "../src/entrypoint.tsx";
import { createGamesFeature } from "../src/registration.ts";
import {
  chains,
  embeddedGame,
  templateGame,
  claimsConfig,
  runsConfig,
  walletConfig,
  rewardsGame,
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

describe("a game whose milestones can be claimed", () => {
  it("is given a claims section, with the wallet connection behind it, and the player's wallet is not shown on the game's account", async () => {
    const markup = await render([rewardsGame], "/games/[slug]", "rewards-game");
    expect(markup).toContain("Claims");
    expect(markup).not.toContain("Your wallet");
  });

  it("is given none when it declares no rewards", async () => {
    const markup = await render(
      [embeddedGame],
      "/games/[slug]",
      "embedded-game",
    );
    expect(markup).not.toContain("Claims");
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
        listMintedMilestonesRoute,
        getMintedPictureRoute,
        createShareRoute,
        revokeShareRoute,
        getSharedPictureRoute,
        listGalleryMintsRoute,
        getGalleryPictureRoute,
        getLeaderboardRoute,
        getMyRankRoute,
        recordGamePlayRoute,
      ],
    });
    // Only a signed-in player has milestones: the page is not public, so the platform sends everyone else to sign in.
    expect(
      feature.manifest.pages.find(({ path }) => path === myMilestonesPath),
    ).toMatchObject({ access: { kind: "authenticated" } });
    const entrypoint = await feature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["games"],
    });
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual(
      feature.manifest.pages.map(({ path }) => path),
    );
  });
});
