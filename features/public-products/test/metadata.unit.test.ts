import { describe, expect, it } from "vitest";

import { creatorsCatalog, launchesCatalog } from "../src/domain/catalog.ts";
import { createPublicProductEntrypoint } from "../src/entrypoint.tsx";
import { productIndexMetadata } from "../src/metadata.ts";

describe("launches and creators in search and previews", () => {
  it.each([launchesCatalog, creatorsCatalog])(
    "share the $label page under its own name and description",
    async (catalog) => {
      const [index] = createPublicProductEntrypoint(catalog).pages ?? [];
      expect(index?.path).toBe(catalog.path);
      expect(await index?.metadata?.({ params: {} })).toEqual(
        productIndexMetadata(catalog),
      );
      expect(productIndexMetadata(catalog)).toEqual({
        description: catalog.metadataDescription,
        kind: "shared",
        title: catalog.label,
      });
    },
  );

  it.each([launchesCatalog, creatorsCatalog])(
    "leave one $detailNoun's own page undeclared, so it stays out of search results",
    (catalog) => {
      const detail = createPublicProductEntrypoint(catalog).pages?.[1];
      expect(detail?.path).toBe(`${catalog.path}/[slug]`);
      expect(detail?.metadata).toBeUndefined();
    },
  );

  it.each([launchesCatalog, creatorsCatalog])(
    "list the $label page in the sitemap",
    async (catalog) => {
      expect(
        await createPublicProductEntrypoint(catalog).sitemapPaths?.(),
      ).toEqual([catalog.path]);
    },
  );
});
