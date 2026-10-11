import { describe, expect, it } from "vitest";

import {
  addCollectionItemInputSchema,
  collectionAssetPurposes,
  collectionDetailSchema,
  collectionDraftSchema,
  collectionItemSchema,
  collectionLimits,
  collectionRoutes,
  collectionStudioPath,
  collectionWizardHref,
  collectionWizardPath,
  removeCollectionItemInputSchema,
  saveCollectionDraftInputSchema,
} from "../src/collections/index.ts";
import {
  pageContributionSchema,
  routeContributionSchema,
} from "../src/features/manifest.ts";
import { uploadPurposes } from "../src/uploads/index.ts";

const chain = "bip122:00000008819873e925422c1ff0f99f7c";
const asset = "018f22f2-9c1a-7b21-8c45-000000000001";
const draft = {
  bannerAssetId: null,
  coverAssetId: null,
  description: "",
  name: "First light",
  plannedSupply: 5,
  provenance: "",
  targetChain: chain,
};
const item = {
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "",
  imageAssetId: asset,
  name: "Item",
};

describe("collection draft", () => {
  it("accepts a minimal draft and trims text", () => {
    const parsed = collectionDraftSchema.parse({
      ...draft,
      name: "  Padded  ",
    });
    expect(parsed.name).toBe("Padded");
  });

  it.each([
    ["an empty name", { name: "   " }],
    ["a name over the limit", { name: "x".repeat(collectionLimits.name + 1) }],
    [
      "a description over the limit",
      { description: "x".repeat(collectionLimits.description + 1) },
    ],
    [
      "a provenance over the limit",
      { provenance: "x".repeat(collectionLimits.provenance + 1) },
    ],
    ["zero supply", { plannedSupply: 0 }],
    ["a fractional supply", { plannedSupply: 1.5 }],
    [
      "supply over the limit",
      { plannedSupply: collectionLimits.plannedSupply + 1 },
    ],
    ["a chain that is not CAIP-2", { targetChain: "bitcoin" }],
    ["a malformed asset id", { coverAssetId: "not-a-uuid" }],
    ["an unknown field", { price: 1 }],
  ])("rejects %s", (_name, change) => {
    expect(
      collectionDraftSchema.safeParse({ ...draft, ...change }).success,
    ).toBe(false);
  });

  it("accepts the limits exactly", () => {
    expect(
      collectionDraftSchema.safeParse({
        ...draft,
        description: "x".repeat(collectionLimits.description),
        name: "x".repeat(collectionLimits.name),
        plannedSupply: collectionLimits.plannedSupply,
        provenance: "x".repeat(collectionLimits.provenance),
      }).success,
    ).toBe(true);
  });
});

describe("collection item", () => {
  it("accepts an item with attributes", () => {
    expect(collectionItemSchema.safeParse(item).success).toBe(true);
  });

  it.each([
    [
      "a repeated trait",
      {
        attributes: [
          { trait: "A", value: "1" },
          { trait: "A", value: "2" },
        ],
      },
    ],
    [
      "too many attributes",
      {
        attributes: Array.from(
          { length: collectionLimits.attributesPerItem + 1 },
          (_, index) => ({ trait: `t${index}`, value: "v" }),
        ),
      },
    ],
    ["an empty trait", { attributes: [{ trait: " ", value: "v" }] }],
    ["an empty value", { attributes: [{ trait: "t", value: "" }] }],
    [
      "a long value",
      {
        attributes: [
          {
            trait: "t",
            value: "v".repeat(collectionLimits.attributeValueLength + 1),
          },
        ],
      },
    ],
    ["an empty name", { name: "" }],
    ["a missing image", { imageAssetId: undefined }],
  ])("rejects %s", (_name, change) => {
    expect(collectionItemSchema.safeParse({ ...item, ...change }).success).toBe(
      false,
    );
  });

  it("accepts the attribute limit exactly", () => {
    const attributes = Array.from(
      { length: collectionLimits.attributesPerItem },
      (_, index) => ({
        trait: `t${index}`,
        value: "v",
      }),
    );
    expect(
      collectionItemSchema.safeParse({ ...item, attributes }).success,
    ).toBe(true);
  });
});

describe("collection HTTP contract", () => {
  it("requires the revision a save is based on", () => {
    const input = { collectionId: asset, draft };
    expect(saveCollectionDraftInputSchema.safeParse(input).success).toBe(false);
    expect(
      saveCollectionDraftInputSchema.safeParse({
        ...input,
        expectedRevision: 0,
      }).success,
    ).toBe(false);
    expect(
      saveCollectionDraftInputSchema.safeParse({
        ...input,
        expectedRevision: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects stray fields on item inputs", () => {
    expect(
      addCollectionItemInputSchema.safeParse({
        collectionId: asset,
        item,
        extra: 1,
      }).success,
    ).toBe(false);
    expect(
      removeCollectionItemInputSchema.safeParse({
        collectionId: asset,
        itemId: "x",
      }).success,
    ).toBe(false);
  });

  it("describes a detail with items and previews", () => {
    const detail = {
      collection: {
        ...draft,
        createdAt: "2026-10-09T12:00:00Z",
        id: asset,
        revision: 1,
        updatedAt: "2026-10-09T12:00:00Z",
      },
      items: [{ ...item, id: asset, position: 1 }],
      previews: [],
    };
    expect(collectionDetailSchema.safeParse(detail).success).toBe(true);
    expect(
      collectionDetailSchema.safeParse({
        ...detail,
        items: [{ ...item, id: asset, position: 0 }],
      }).success,
    ).toBe(false);
  });

  it("uses routes the feature manifest accepts, with a distinct operation id and method per path", () => {
    const routes = Object.values(collectionRoutes);
    for (const route of routes)
      expect(routeContributionSchema.safeParse(route).success).toBe(true);
    expect(new Set(routes.map(({ operationId }) => operationId)).size).toBe(
      routes.length,
    );
    expect(
      new Set(routes.map(({ method, path }) => `${method} ${path}`)).size,
    ).toBe(routes.length);
  });

  it("builds the wizard link from the page route, and the page routes are accepted by the manifest", () => {
    expect(collectionWizardHref(asset)).toBe(
      `${collectionStudioPath}/${asset}`,
    );
    expect(collectionWizardPath.replace("[collectionId]", asset)).toBe(
      collectionWizardHref(asset),
    );
    for (const path of [collectionStudioPath, collectionWizardPath])
      expect(
        pageContributionSchema.safeParse({
          access: { kind: "authenticated" },
          path,
        }).success,
      ).toBe(true);
  });

  it("names only upload purposes that exist", () => {
    for (const purpose of Object.values(collectionAssetPurposes))
      expect(uploadPurposes).toContain(purpose);
  });
});
