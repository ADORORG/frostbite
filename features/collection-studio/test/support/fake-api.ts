import { ApiError } from "@frostbite/client-http";
import type {
  CollectionDetail,
  CollectionSubmission,
  CollectionSummary,
} from "@frostbite/shared/collections";
import type { CreatorApplicationState } from "@frostbite/shared/creator-admission";
import { idempotencyKeySchema } from "@frostbite/shared/http";
import type { LibraryAsset } from "@frostbite/shared/uploads";
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

interface FakeState {
  detail: CollectionDetail;
  library: LibraryAsset[];
  standing: CreatorApplicationState | null;
  submissions: CollectionSubmission[];
  summaries: CollectionSummary[];
}

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
  const submissions: CollectionSubmission[] = [];
  const state: FakeState = {
    detail: initial,
    library: [...library],
    // The caller's creator application state; approved unless a test stages another standing.
    standing: "approved",
    submissions,
    summaries,
  };
  const submittedKeys = new Map<string, CollectionSubmission>();
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
    creatorStanding: vi.fn<CollectionsApi["creatorStanding"]>(async () => ({
      state: state.standing,
    })),
    // The server's rules for an import: images found by file name among the library's processed item
    // images, rows past the planned supply refused, and all of it or none of it written.
    importItems: vi.fn<CollectionsApi["importItems"]>(
      async ({ dryRun, rows }) => {
        const room =
          state.detail.collection.plannedSupply - state.detail.items.length;
        const report = rows.map((row, at) => {
          const found = state.library.find(
            (asset) =>
              asset.purpose === "collection-item-artwork" &&
              asset.processingState === "processed" &&
              asset.fileName?.toLowerCase() === row.imageFileName.toLowerCase(),
          );
          return {
            imageAssetId: found?.id ?? null,
            problems: [
              ...(found === undefined ? (["image-not-found"] as const) : []),
              ...(at >= room ? (["over-supply"] as const) : []),
            ],
            row: at + 1,
          };
        });
        if (dryRun || report.some(({ problems }) => problems.length > 0))
          return { imported: false, revision: null, rows: report };
        state.detail = {
          ...state.detail,
          items: [
            ...state.detail.items,
            ...rows.map((row, at) => ({
              attributes: row.attributes,
              description: row.description,
              id: id(),
              imageAssetId: report[at]?.imageAssetId ?? "",
              name: row.name,
              position: state.detail.items.length + at + 1,
            })),
          ],
        };
        return { imported: true, revision: bump(), rows: report };
      },
    ),
    list: vi.fn<CollectionsApi["list"]>(async () => ({
      collections: state.summaries,
    })),
    listImages: vi.fn<CollectionsApi["listImages"]>(async () => ({
      assets: state.library,
      nextCursor: null,
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
    listSubmissions: vi.fn<CollectionsApi["listSubmissions"]>(async () => ({
      submissions: state.submissions,
    })),
    // Freezes the revision named, newest first, and replays a key it has already answered.
    submit: vi.fn<CollectionsApi["submit"]>(
      async ({ collectionId, expectedRevision }, { idempotencyKey }) => {
        const replay = submittedKeys.get(idempotencyKey);
        if (replay !== undefined) return { submission: replay };
        if (expectedRevision !== state.detail.collection.revision)
          throw revisionConflict();
        const stamp = new Date("2026-10-10T12:00:00.000Z").toISOString();
        const submission: CollectionSubmission = {
          collectionId,
          collectionRevision: expectedRevision,
          createdAt: stamp,
          decisions: [],
          id: id(),
          payloadHash: "a".repeat(64),
          sequence: state.submissions.length + 1,
          state: "submitted",
          updatedAt: stamp,
        };
        state.submissions = [submission, ...state.submissions];
        submittedKeys.set(idempotencyKey, submission);
        return { submission };
      },
    ),
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
