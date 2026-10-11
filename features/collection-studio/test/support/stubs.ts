import type {
  CollectionAggregate,
  CollectionItemRecord,
} from "@ador/collections";
import { chainRefSchema } from "@ador/shared/chain";
import { idempotencyKeySchema } from "@ador/shared/http";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import type { LibraryAsset } from "@ador/shared/uploads";
import { vi } from "vitest";

import type {
  AssetPreviews,
  CollectionService,
  OperationDependencies,
} from "../../src/application/dependencies.ts";

export const id = () => uuidV7Schema.parse(createUuidV7());
export const userId = id();
export const signet = chainRefSchema.parse(
  "bip122:00000008819873e925422c1ff0f99f7c",
);

export const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
  idempotencyKey: idempotencyKeySchema.parse("request-key-00000001"),
};

export const anonymous = { ...context, actorUserId: null };

const at = new Date("2026-10-09T12:00:00.000Z");

export const itemRecord = (
  imageAssetId = id(),
  position = 1,
): CollectionItemRecord => ({
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "An item",
  id: id(),
  imageAssetId,
  name: "Item",
  position,
});

export function aggregate(
  overrides: Partial<CollectionAggregate["collection"]> = {},
  items: readonly CollectionItemRecord[] = [],
): CollectionAggregate {
  return {
    collection: {
      bannerAssetId: null,
      coverAssetId: null,
      createdAt: at,
      description: "Desc",
      id: id(),
      name: "First light",
      plannedSupply: 5,
      provenance: "Drawn",
      revision: 1,
      targetChain: signet,
      updatedAt: at,
      ...overrides,
    },
    items,
  };
}

export const preview = (assetId: string): LibraryAsset => ({
  createdAt: at.toISOString(),
  derivativeAccess: "none",
  derivatives: [],
  fileName: null,
  heightPixels: null,
  id: assetId,
  processingState: "pending-validation",
  purpose: "collection-artwork",
  rejectionReason: null,
  widthPixels: null,
});

const missing = { kind: "not-found" } as const;

// A service whose every method answers "not found" unless the test replaces it.
export function stubService(
  overrides: Partial<CollectionService> = {},
): CollectionService {
  return {
    addItem: async () => missing,
    create: async () => missing,
    find: async () => null,
    list: async () => [],
    removeItem: async () => missing,
    save: async () => missing,
    updateItem: async () => missing,
    ...overrides,
  };
}

export function stubDependencies(
  service: CollectionService,
  getMany: AssetPreviews["getMany"] = async () => [],
) {
  const getService = vi.fn(async () => service);
  const getPreviews = vi.fn(async (): Promise<AssetPreviews> => ({ getMany }));
  const dependencies: OperationDependencies = { getPreviews, getService };
  return { dependencies, getPreviews, getService };
}
