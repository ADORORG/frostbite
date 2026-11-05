import { beforeAll, describe, expect, it } from "vitest";

import { collectionsUnavailable, noCollections } from "../src/ui/states.tsx";
import { brokenProviders, migrate, railFor } from "./support/harness.tsx";

beforeAll(migrate);

// The rail that shows an approved collection is tested with the pages in pages.integration.test.tsx, which share one database and
// expect it empty at the start; this file changes none of it.
describe("the landing page's rail of collections, over the real database", () => {
  it("is declared as a section of the landing page, after games and before launches", async () => {
    const { createPublicCollectionsEntrypoint } =
      await import("../src/entrypoint.tsx");
    const { homeSectionOrder } = await import("@frostbite/shared/platform");
    const { storageRegistry, unusedStorage } =
      await import("@frostbite/test-kit/storage-registry");
    const { chains } = await import("./support/fixtures.ts");
    const entrypoint = createPublicCollectionsEntrypoint(
      storageRegistry(() => unusedStorage),
      chains,
    );
    expect(entrypoint.capabilities).toContain("home-section");
    expect(
      entrypoint.homeSections?.map(({ id, order }) => [id, order]),
    ).toEqual([["collections", homeSectionOrder.collections]]);
    expect(homeSectionOrder.games).toBeLessThan(homeSectionOrder.collections);
    expect(homeSectionOrder.collections).toBeLessThan(
      homeSectionOrder.launches,
    );
  });

  it("says the catalog is unavailable, rather than empty, when it cannot be read", async () => {
    const markup = await railFor(brokenProviders);
    expect(markup).toContain(collectionsUnavailable.body);
    expect(markup).not.toContain(noCollections.body);
  });
});
