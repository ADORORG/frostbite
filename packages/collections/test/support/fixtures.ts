import type {
  CollectionDraft,
  CollectionImportRow,
  CollectionItem,
} from "@ador/shared/collections";
import { chainRefSchema } from "@ador/shared/chain";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";

export const now = new Date("2026-10-09T12:00:00.000Z");

export const signet = chainRefSchema.parse(
  "bip122:00000008819873e925422c1ff0f99f7c",
);

export const draft = (
  overrides: Partial<CollectionDraft> = {},
): CollectionDraft => ({
  bannerAssetId: null,
  coverAssetId: null,
  description: "A small collection",
  name: "First light",
  plannedSupply: 5,
  provenance: "Drawn by hand",
  targetChain: signet,
  ...overrides,
});

export const itemFor = (
  imageAssetId: string,
  overrides: Partial<CollectionItem> = {},
): CollectionItem => ({
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "An item",
  imageAssetId,
  name: "Item",
  ...overrides,
});

let counter = 0;
export function key(): string {
  counter += 1;
  return `request-key-${String(counter).padStart(8, "0")}`;
}

export const newId = () => uuidV7Schema.parse(createUuidV7());

export function mutation(ownerUserId: ReturnType<typeof newId>) {
  return {
    changedAt: now,
    idempotencyKey: key(),
    ownerUserId,
    requestFingerprint: "a".repeat(64),
  };
}

// One line of an import, naming its image by file name.
export const rowFor = (
  imageFileName: string,
  overrides: Partial<CollectionImportRow> = {},
): CollectionImportRow => ({
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "An item",
  imageFileName,
  name: `Item for ${imageFileName}`,
  ...overrides,
});
