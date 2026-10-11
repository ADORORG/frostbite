// Engineering boundary limits protect storage, rendering, and request size. They are not product
// quotas, which stay gated; changing a value here is a schema change, reviewed like one.
export const collectionLimits = Object.freeze({
  attributeTraitLength: 64,
  attributeValueLength: 128,
  attributesPerItem: 32,
  description: 4_000,
  itemDescription: 1_000,
  itemName: 120,
  // Rows one import accepts. A longer list is imported in several files: a request is also bounded in
  // bytes, and one import is all-or-nothing, so it should stay small enough to review.
  importRows: 500,
  itemsPerCollection: 10_000,
  name: 120,
  plannedSupply: 1_000_000,
  provenance: 2_000,
});

// The assets a collection draft may reference, by the purpose they were uploaded for.
export const collectionAssetPurposes = Object.freeze({
  banner: "collection-banner",
  cover: "collection-artwork",
  item: "collection-item-artwork",
} as const);
