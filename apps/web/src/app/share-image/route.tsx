import { siteTagline } from "@ador/shared/platform";

import { defaultImageCacheControl } from "../../server/metadata/cache";
import { shareCardResponse } from "../../server/metadata/share-card";
import { readSiteIdentity } from "../../server/metadata/site";

// The picture a link preview shows when the page has none of its own.
export function GET() {
  const site = readSiteIdentity();
  return shareCardResponse(
    {
      kicker: "Arcade",
      picture: null,
      subtitle: siteTagline,
      title: site.name,
    },
    defaultImageCacheControl,
  );
}
