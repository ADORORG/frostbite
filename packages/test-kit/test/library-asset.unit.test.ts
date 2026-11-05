import { libraryAssetSchema } from "@frostbite/shared/uploads";
import { describe, expect, it } from "vitest";

import { libraryAssetFixture } from "../src/library-asset.ts";

describe("library asset fixture", () => {
  it("is a valid processed library asset with a thumbnail for the given purpose and id", () => {
    const asset = libraryAssetFixture(
      "collection-artwork",
      "018f22f2-9c1a-7b21-8c45-000000000001",
    );
    expect(libraryAssetSchema.safeParse(asset).success).toBe(true);
    expect(asset).toMatchObject({
      derivativeAccess: "available",
      id: "018f22f2-9c1a-7b21-8c45-000000000001",
      processingState: "processed",
      purpose: "collection-artwork",
    });
    expect(asset.derivatives[0]?.kind).toBe("thumbnail");
  });

  it("lets a test override any field, such as an asset that is still processing", () => {
    const asset = libraryAssetFixture("collection-banner", "x", {
      derivativeAccess: "unavailable",
      derivatives: [],
      processingState: "pending-validation",
    });
    expect(asset).toMatchObject({
      derivatives: [],
      processingState: "pending-validation",
    });
  });
});
