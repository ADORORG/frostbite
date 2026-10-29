import { beforeAll, describe, expect, it } from "vitest";

import { brokenProviders, migrate, railFor } from "./support/harness.tsx";

beforeAll(migrate);

// The rail that shows an approved collection is tested with the pages in pages.integration.test.tsx, which share one database and
// expect it empty at the start; this file changes none of it.
describe("the landing page's rail of collections, over the real database", () => {
  it("is declared as a section of the landing page, after launches and before games", async () => {
    const { createPublicCollectionsEntrypoint } =
      await import("../src/entrypoint.tsx");
    const { homeSectionOrder } = await import("@ador/shared/platform");
    const { storageRegistry, unusedStorage } =
      await import("@ador/test-kit/storage-registry");
    const { chains } = await import("./support/fixtures.ts");
    const entrypoint = createPublicCollectionsEntrypoint(
      storageRegistry(() => unusedStorage),
      chains,
    );
    expect(entrypoint.capabilities).toContain("home-section");
    expect(
      entrypoint.homeSections?.map(({ id, order }) => [id, order]),
    ).toEqual([["collections", homeSectionOrder.collections]]);
    expect(homeSectionOrder.launches).toBeLessThan(
      homeSectionOrder.collections,
    );
    expect(homeSectionOrder.collections).toBeLessThan(homeSectionOrder.games);
  });

  it("says the catalog is unavailable, rather than empty, when it cannot be read", async () => {
    const markup = await railFor(brokenProviders);
    expect(markup).toContain("Catalog unavailable");
    expect(markup).toContain("Collections are unavailable");
    expect(markup).not.toContain("No collections online");
  });
});
