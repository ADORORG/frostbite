import { describe, expect, it } from "vitest";

import {
  canUseInCollection,
  effectivePurposeFilter,
  purposeFilterOptions,
  visibleAssets,
} from "../../src/client/library-view.ts";
import { libraryAsset, processedAsset } from "../support/library-fixtures.ts";

const ready = processedAsset({ purpose: "collection-artwork" });
const rejected = libraryAsset({
  purpose: "creator-avatar",
  processingState: "rejected",
});
const assets = [
  ready,
  processedAsset({ purpose: "collection-artwork" }),
  rejected,
];

describe("library view", () => {
  it("counts each purpose that has an image, in the policy's order, and omits the rest", () => {
    expect(
      purposeFilterOptions(assets).map(({ count, value }) => [value, count]),
    ).toEqual([
      ["all", 3],
      ["collection-artwork", 2],
      ["creator-avatar", 1],
    ]);
    expect(purposeFilterOptions([])).toEqual([
      { count: 0, label: "All", value: "all" },
    ]);
  });

  it("shows everything for All and only the matching purpose otherwise", () => {
    expect(visibleAssets(assets, "all")).toHaveLength(3);
    expect(visibleAssets(assets, "creator-avatar")).toEqual([rejected]);
    expect(visibleAssets(assets, "collection-banner")).toEqual([]);
  });

  it("keeps the chosen filter while it matches something, and falls back to All when it no longer does", () => {
    const options = purposeFilterOptions(assets);
    expect(effectivePurposeFilter(options, "creator-avatar")).toBe(
      "creator-avatar",
    );
    expect(effectivePurposeFilter(options, "collection-banner")).toBe("all");
  });

  it("lets only a finished image be used", () => {
    expect(canUseInCollection(ready)).toBe(true);
    expect(canUseInCollection(rejected)).toBe(false);
    expect(
      canUseInCollection(libraryAsset({ processingState: "validated" })),
    ).toBe(false);
  });
});
