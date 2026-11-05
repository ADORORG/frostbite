import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  crawlerBlockedPaths,
  robotsFor,
  sitemapFor,
} from "../src/server/metadata/crawl-rules";
import {
  pageMetadata,
  siteMetadata,
} from "../src/server/metadata/next-metadata";
import { readSiteIdentity } from "../src/server/metadata/site";

const site = { name: "Frostbit", origin: "https://play.example.com" };

describe("the site's identity", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PUBLIC_BASE_URL", "https://play.example.com/some/path?x=1");
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", " Frostbit ");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is the configured name and the public origin alone, never a path", () => {
    expect(readSiteIdentity()).toEqual(site);
  });

  it("refuses a missing public address instead of guessing one", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    expect(() => readSiteIdentity()).toThrow();
  });
});

describe("the site-wide metadata", () => {
  const base = siteMetadata(site);

  it("resolves relative addresses against the public origin", () => {
    expect(base.metadataBase?.toString()).toBe("https://play.example.com/");
  });

  it("titles every page with the site's name and has a default title", () => {
    expect(base.title).toEqual({
      default: "Frostbit | Play, earn, collect on Bitcoin",
      template: "%s | Frostbit",
    });
    expect(base.applicationName).toBe("Frostbit");
  });

  it("carries a large-image preview with the default picture's size and words", () => {
    expect(base.twitter).toEqual({ card: "summary_large_image" });
    expect(base.openGraph).toMatchObject({
      images: [
        {
          alt: expect.any(String),
          height: 630,
          url: "/share-image",
          width: 1200,
        },
      ],
      siteName: "Frostbit",
      type: "website",
    });
  });
});

describe("one page's metadata", () => {
  it("names a shared page, its canonical address and its preview", () => {
    const tags = pageMetadata(
      {
        description: "Jump spikes.",
        image: { alt: "A runner", path: "/games/x/share-image" },
        kind: "shared",
        title: "Frost Runner",
      },
      site,
      "/games/x",
    );
    expect(tags).toMatchObject({
      alternates: { canonical: "/games/x" },
      description: "Jump spikes.",
      title: "Frost Runner",
    });
    expect(tags.openGraph).toMatchObject({
      images: [
        {
          alt: "A runner",
          height: 630,
          url: "/games/x/share-image",
          width: 1200,
        },
      ],
      title: "Frost Runner",
      url: "/games/x",
    });
    expect(tags.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ alt: "A runner", url: "/games/x/share-image" }],
    });
    expect(tags.robots).toBeUndefined();
  });

  it("uses the site's picture when the page has none", () => {
    const tags = pageMetadata(
      { description: "d", kind: "shared", title: "t" },
      site,
      "/",
    );
    expect(tags.openGraph).toMatchObject({
      images: [{ url: "/share-image" }],
    });
  });

  it("keeps a private page out of search results and gives it no preview", () => {
    const tags = pageMetadata({ kind: "private" }, site, "/studio");
    expect(tags).toEqual({
      openGraph: null,
      robots: { follow: false, index: false },
      twitter: null,
    });
  });
});

describe("what crawlers are told", () => {
  it("points robots.txt at the sitemap on the public origin and closes the private areas", () => {
    expect(robotsFor(site)).toEqual({
      rules: {
        allow: "/",
        disallow: [...crawlerBlockedPaths],
        userAgent: "*",
      },
      sitemap: "https://play.example.com/sitemap.xml",
    });
    for (const path of [
      "/studio",
      "/admin",
      "/account",
      "/sign-in",
      "/setup",
      "/api/",
    ])
      expect(crawlerBlockedPaths).toContain(path);
  });

  it("lists each address once, absolute, on the public origin", () => {
    expect(sitemapFor(site, ["/", "/games", "/games/frost-runner"])).toEqual([
      { url: "https://play.example.com/" },
      { url: "https://play.example.com/games" },
      { url: "https://play.example.com/games/frost-runner" },
    ]);
    expect(sitemapFor(site, [])).toEqual([]);
  });
});
