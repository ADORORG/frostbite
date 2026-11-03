import type { MetadataRoute } from "next";

import { platformComposition } from "@repo/configs/platform";
import { sitemapFor } from "../server/metadata/crawl-rules";
import { readSiteIdentity } from "../server/metadata/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapFor(
    readSiteIdentity(),
    await platformComposition.features.listSitemapPaths(),
  );
}
