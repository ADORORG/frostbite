import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { games } from "@repo/configs/games";
import { GET as gameImage } from "../src/app/games/[id]/share-image/route";
import robots from "../src/app/robots";
import { GET as defaultImage } from "../src/app/share-image/route";
import sitemap from "../src/app/sitemap";

beforeEach(() => {
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("PUBLIC_BASE_URL", "https://play.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Frostbite");
});
afterEach(() => vi.unstubAllEnvs());

const idOf = (id: string) => ({ params: Promise.resolve({ id }) });
const request = new Request("https://play.example.com/x");

describe("robots.txt and the sitemap", () => {
  it("name the public origin, never the internal one", async () => {
    expect(robots().sitemap).toBe("https://play.example.com/sitemap.xml");
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(1);
    for (const { url } of entries)
      expect(url.startsWith("https://play.example.com/")).toBe(true);
    expect(entries.map(({ url }) => url)).toContain(
      "https://play.example.com/games",
    );
  });

  it("list no private page", async () => {
    const urls = (await sitemap()).map(({ url }) => new URL(url).pathname);
    for (const prefix of [
      "/studio",
      "/admin",
      "/account",
      "/sign-in",
      "/setup",
      "/api",
    ])
      expect(urls.filter((path) => path.startsWith(prefix))).toEqual([]);
    expect(urls).not.toContain("/games/milestones");
  });
});

describe("the share pictures", () => {
  it("serve the site's picture as a PNG a shared cache may keep", async () => {
    const response = defaultImage();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  it("serve a registered game's picture", async () => {
    const [game] = games;
    if (game === undefined) throw new Error("Expected a registered game.");
    const response = await gameImage(request, idOf(game.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it.each(["no-such-game", "NOT A SLUG", "../etc", ""])(
    "have none for %j, so an address reveals nothing about what is not listed",
    async (id) => {
      const response = await gameImage(request, idOf(id));
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBeNull();
    },
  );
});
