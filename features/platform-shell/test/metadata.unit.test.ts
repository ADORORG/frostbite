import { siteDescription, siteTagline } from "@ador/shared/platform";
import { describe, expect, it } from "vitest";

import { createPlatformShellEntrypoint } from "../src/entrypoint.js";

const entrypoint = createPlatformShellEntrypoint({
  registeredFeatureCount: 1,
  registeredFeatureIds: ["platform-shell"],
});

describe("the landing page in search and previews", () => {
  it("is shared under the site's tagline and description, from the one place they are written", async () => {
    const [page] = entrypoint.pages ?? [];
    expect(page?.path).toBe("/");
    expect(await page?.metadata?.({ params: {} })).toEqual({
      description: siteDescription,
      kind: "shared",
      title: siteTagline,
    });
  });

  it("is in the sitemap, alone, because this feature has no other public page", async () => {
    expect(await entrypoint.sitemapPaths?.()).toEqual(["/"]);
  });
});
