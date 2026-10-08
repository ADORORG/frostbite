import { describe, expect, it } from "vitest";

import {
  assetBadge,
  assetNote,
  describeDimensions,
  pickRendition,
} from "../../src/client/asset-presentation.ts";
import {
  purposeLabels,
  purposeOptions,
} from "../../src/client/purpose-labels.ts";
import { libraryAsset, processedAsset } from "../support/library-fixtures.ts";

describe("asset presentation", () => {
  it("gives every state a distinct badge, using red only for the failure states", () => {
    const states = [
      "pending-validation",
      "validated",
      "processed",
      "rejected",
      "unprocessable",
    ] as const;
    expect(states.map((state) => assetBadge(state).label)).toEqual([
      "Checking",
      "Processing",
      "Ready",
      "Rejected",
      "Unusable",
    ]);
    expect(states.filter((state) => assetBadge(state).tone === "red")).toEqual([
      "rejected",
      "unprocessable",
    ]);
    expect(assetBadge("processed").tone).toBe("mint");
  });

  it("notes a rejection reason first, then an unavailable preview, then a pending check", () => {
    expect(
      assetNote(
        libraryAsset({
          processingState: "rejected",
          rejectionReason: "malformed",
        }),
      ),
    ).toContain("not a valid image");
    expect(
      assetNote(
        processedAsset({ derivativeAccess: "unavailable", derivatives: [] }),
      ),
    ).toContain("temporarily unavailable");
    expect(assetNote(libraryAsset())).toContain("Still being checked");
    expect(assetNote(libraryAsset({ processingState: "validated" }))).toContain(
      "Still being checked",
    );
    expect(assetNote(processedAsset())).toBeNull();
    expect(
      assetNote(
        libraryAsset({
          derivativeAccess: "unavailable",
          processingState: "rejected",
        }),
      ),
    ).toBeNull();
  });

  it("picks a rendition by kind", () => {
    const { derivatives } = processedAsset();
    expect(pickRendition(derivatives, "thumbnail")?.widthPixels).toBe(4);
    expect(pickRendition(derivatives, "preview")?.widthPixels).toBe(40);
    expect(pickRendition([], "preview")).toBeUndefined();
  });

  it("describes dimensions only when both are known", () => {
    expect(describeDimensions({ heightPixels: 30, widthPixels: 40 })).toBe(
      "40 × 30 px",
    );
    expect(
      describeDimensions({ heightPixels: null, widthPixels: 40 }),
    ).toBeNull();
    expect(
      describeDimensions({ heightPixels: 30, widthPixels: null }),
    ).toBeNull();
  });
});

describe("purpose labels", () => {
  it("labels every purpose and offers them in the same order", () => {
    expect(purposeOptions.map(({ value }) => value)).toEqual(
      Object.keys(purposeLabels).sort(),
    );
    expect(purposeOptions.map(({ label }) => label)).toEqual([
      "Collection artwork",
      "Collection banner",
      "Collection item artwork",
      "Creator avatar",
    ]);
  });
});
