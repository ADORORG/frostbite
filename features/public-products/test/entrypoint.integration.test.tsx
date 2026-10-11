import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createPublicProductEntrypoint } from "../src/entrypoint.tsx";
import { creatorsCatalog } from "../src/domain/catalog.ts";
import { launchesFeature } from "../src/registration.ts";

describe("public product entrypoint", () => {
  it("matches its manifest and renders honest empty indexes", async () => {
    const entrypoint = await launchesFeature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["launches"],
    });
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual(
      launchesFeature.manifest.pages.map(({ path }) => path),
    );
    const page = entrypoint.pages?.find(({ path }) => path === "/launches");
    const markup = renderToStaticMarkup(
      await page?.render({ actorUserId: null, navigation: [], params: {} }),
    );
    expect(markup).toContain("No launches online");
    expect(markup).toContain("No launch is published");
    expect(markup).not.toContain("Mint now");
  });

  it("renders valid and invalid detail identifiers as unavailable", async () => {
    const page = createPublicProductEntrypoint(creatorsCatalog).pages?.find(
      ({ path }) => path === "/creators/[slug]",
    );
    const valid = renderToStaticMarkup(
      await page?.render({
        actorUserId: null,
        navigation: [],
        params: { slug: "frostbite" },
      }),
    );
    const invalid = renderToStaticMarkup(
      await page?.render({
        actorUserId: null,
        navigation: [],
        params: { slug: "Frostbite" },
      }),
    );
    expect(valid).toContain("No published creator matches");
    expect(valid).toContain("frostbite");
    expect(invalid).toContain("Invalid route");
    expect(invalid).not.toContain("Frostbite");
  });
});
