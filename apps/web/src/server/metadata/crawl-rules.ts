import type { MetadataRoute } from "next";

import type { SiteIdentity } from "./site.ts";

// Where crawlers are asked not to go. The pages behind sign-in are kept out by their own `noindex` as well (a crawler that never
// fetches a page never sees it), and the API and the games' own files are not pages to search.
export const crawlerBlockedPaths = [
  "/account",
  "/admin",
  "/api/",
  "/games/milestones",
  "/play/",
  "/setup",
  "/sign-in",
  "/studio",
] as const;

export function robotsFor(site: SiteIdentity): MetadataRoute.Robots {
  return {
    rules: { allow: "/", disallow: [...crawlerBlockedPaths], userAgent: "*" },
    sitemap: `${site.origin}/sitemap.xml`,
  };
}

export function sitemapFor(
  site: SiteIdentity,
  paths: readonly string[],
): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: new URL(path, site.origin).toString(),
  }));
}
