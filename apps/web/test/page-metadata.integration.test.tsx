import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The wallet library needs the app's provider, which the layout supplies; these tests load the page module on its own.
vi.mock("@ador/wallet/client", () => ({
  useWalletChooser: () => ({ request: () => undefined }),
  useWalletConnection: () => ({
    address: "",
    connected: false,
    network: "signet",
    provider: null,
    signMessage: async () => "",
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { generateMetadata } from "../src/app/[[...path]]/page";
import { games } from "@repo/configs/games";

beforeEach(() => {
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("PUBLIC_BASE_URL", "https://play.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Frostbit");
});
afterEach(() => vi.unstubAllEnvs());

const metadataOf = (...path: string[]) =>
  generateMetadata({
    params: Promise.resolve({ path }),
    searchParams: Promise.resolve({}),
  });

describe("the metadata a real page declares", () => {
  it("shares the landing page under the site's tagline", async () => {
    expect(await metadataOf()).toMatchObject({
      alternates: { canonical: "/" },
      title: "Play, earn, collect on Bitcoin",
    });
  });

  it("shares the games page and each registered game, with the game's own words and picture", async () => {
    expect(await metadataOf("games")).toMatchObject({ title: "Games" });
    const [game] = games;
    if (game === undefined) throw new Error("Expected a registered game.");
    expect(await metadataOf("games", game.id)).toMatchObject({
      alternates: { canonical: `/games/${game.id}` },
      description: game.summary,
      openGraph: { images: [{ url: `/games/${game.id}/share-image` }] },
      title: game.title,
    });
  });

  it("shares the launches and creators pages under their own names, and none of a single one's", async () => {
    expect(await metadataOf("launches")).toMatchObject({
      alternates: { canonical: "/launches" },
      title: "Launches",
    });
    expect(await metadataOf("creators")).toMatchObject({
      alternates: { canonical: "/creators" },
      title: "Creators",
    });
    expect((await metadataOf("launches", "a-launch")).robots).toEqual({
      follow: false,
      index: false,
    });
  });

  it.each([
    ["a game that is not registered", ["games", "no-such-game"]],
    ["an address that is not a page", ["no", "such", "page"]],
    ["the player's own milestones", ["games", "milestones"]],
    ["the sign-in page, which is public but not for search", ["sign-in"]],
    ["the setup page", ["setup"]],
    ["the account page", ["account"]],
    ["the studio", ["studio"]],
    ["the admin area", ["admin"]],
  ])("keeps %s out of search results and previews", async (_name, path) => {
    const tags = await metadataOf(...path);
    expect(tags.robots).toEqual({ follow: false, index: false });
    expect(tags.openGraph).toBeNull();
    expect(tags.twitter).toBeNull();
  });
});
