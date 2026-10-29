import { ScenesProvider } from "@ador/scenes/react";
import { homeSectionOrder } from "@ador/shared/platform";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createPublicProductEntrypoint } from "../src/entrypoint.tsx";
import { creatorsCatalog, launchesCatalog } from "../src/domain/catalog.ts";
import { creatorsFeature, launchesFeature } from "../src/registration.ts";

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

  it("gives the landing page a part for launches, saying honestly that none are published, and none for creators", async () => {
    const launches = createPublicProductEntrypoint(launchesCatalog);
    expect(launches.capabilities).toContain("home-section");
    expect(launches.homeSections?.map(({ id, order }) => [id, order])).toEqual([
      ["launches", homeSectionOrder.launches],
    ]);
    const [section] = launches.homeSections ?? [];
    const markup = renderToStaticMarkup(
      <ScenesProvider>{await section?.render()}</ScenesProvider>,
    );
    expect(markup).toContain('id="launches"');
    expect(markup).toContain("scene-backdrop");
    expect(markup).toContain('href="/launches"');
    expect(markup).toContain("See all launches");
    expect(markup).toContain("No launches online");
    expect(markup).toContain("No launch is published");
    expect(markup).not.toContain("cover-card");
    const creators = createPublicProductEntrypoint(creatorsCatalog);
    expect(creators.capabilities).not.toContain("home-section");
    expect(creators.homeSections).toEqual([]);
  });

  it("is declared as a part of the landing page by the manifest exactly where the entrypoint contributes one", async () => {
    for (const feature of [launchesFeature, creatorsFeature]) {
      const entrypoint = await feature.load({
        registeredFeatureCount: 2,
        registeredFeatureIds: ["launches", "creators"],
      });
      expect(feature.manifest.capabilities.includes("home-section")).toBe(
        (entrypoint.homeSections ?? []).length > 0,
      );
    }
  });
});
