import { ApiError } from "@ador/client-http";
import type {
  CollectionDetail,
  CollectionSummary,
} from "@ador/shared/collections";
import { idempotencyKeySchema } from "@ador/shared/http";
import type { LibraryAsset } from "@ador/shared/uploads";
import { vi } from "vitest";

import type { CollectionsApi } from "../../src/client/collections-api.ts";
import type { CollectionsClientServices } from "../../src/client/services.ts";
import { detail as detailFixture, imageAsset } from "./detail.ts";
import { id } from "./stubs.ts";

const revisionConflict = () =>
  new ApiError(
    "conflict",
    409,
    "The draft changed since it was loaded. Reload it and try again.",
  );

// An in-memory collections API with the server's rules that matter to the UI: every change bumps the
// revision, a save must name the current one, and each call is a spy. Tests change `state` to stage a
// situation, and replace any method to stage a failure.
export function fakeCollections(
  initial: CollectionDetail = detailFixture(),
  library: readonly LibraryAsset[] = [
    imageAsset("collection-artwork"),
    imageAsset("collection-banner"),
    imageAsset("collection-item-artwork"),
  ],
) {
  const summaries: CollectionSummary[] = [];
  const state = { detail: initial, library: [...library], summaries };
  const bump = () => {
    state.detail = {
      ...state.detail,
      collection: {
        ...state.detail.collection,
        revision: state.detail.collection.revision + 1,
      },
    };
    return state.detail.collection.revision;
  };
  const api = {
    addItem: vi.fn<CollectionsApi["addItem"]>(async ({ item }) => {
      const record = {
        ...item,
        id: id(),
        position: state.detail.items.length + 1,
      };
      state.detail = {
        ...state.detail,
        items: [...state.detail.items, record],
      };
      return { item: record, revision: bump() };
    }),
    create: vi.fn<CollectionsApi["create"]>(async () => state.detail),
    list: vi.fn<CollectionsApi["list"]>(async () => ({
      collections: state.summaries,
    })),
    listImages: vi.fn<CollectionsApi["listImages"]>(async () => ({
      assets: state.library,
      truncated: false,
    })),
    read: vi.fn<CollectionsApi["read"]>(async () => state.detail),
    removeItem: vi.fn<CollectionsApi["removeItem"]>(async ({ itemId }) => {
      state.detail = {
        ...state.detail,
        items: state.detail.items.filter((item) => item.id !== itemId),
      };
      return { removed: true, revision: bump() };
    }),
    save: vi.fn<CollectionsApi["save"]>(async ({ draft, expectedRevision }) => {
      if (expectedRevision !== state.detail.collection.revision)
        throw revisionConflict();
      state.detail = {
        ...state.detail,
        collection: {
          ...state.detail.collection,
          ...draft,
          revision: expectedRevision + 1,
        },
      };
      return state.detail;
    }),
    updateItem: vi.fn<CollectionsApi["updateItem"]>(
      async ({ item, itemId }) => {
        const current = state.detail.items.find(
          (candidate) => candidate.id === itemId,
        );
        if (current === undefined)
          throw new ApiError("not_found", 404, "The collection was not found.");
        const record = { ...current, ...item };
        state.detail = {
          ...state.detail,
          items: state.detail.items.map((candidate) =>
            candidate.id === itemId ? record : candidate,
          ),
        };
        return { item: record, revision: bump() };
      },
    ),
  } satisfies CollectionsApi;
  let keys = 0;
  const services: CollectionsClientServices = {
    api,
    createIdempotencyKey: () =>
      idempotencyKeySchema.parse(
        `request-key-${String((keys += 1)).padStart(8, "0")}`,
      ),
    navigate: vi.fn<(href: string) => void>(),
  };
  return { api, services, state };
}
