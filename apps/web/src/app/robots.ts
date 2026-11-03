import type { MetadataRoute } from "next";

import { robotsFor } from "../server/metadata/crawl-rules";
import { readSiteIdentity } from "../server/metadata/site";

// The public origin comes from configuration at run time, so the file is made per request, not once at build.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return robotsFor(readSiteIdentity());
}
