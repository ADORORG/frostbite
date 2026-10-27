import {
  encodeActivityCursor,
  reviewActivityResponseSchema,
  reviewDetailResponseSchema,
} from "@ador/shared/collections";
import type { Page } from "@playwright/test";

// Fixed review data for the visual and accessibility checks: the pages are real and their data is
// fixed by answering the API call that carries it, so the baselines show the design in known states.
// Every body is parsed through the shared contract, so a mock that drifts from it fails loudly.
// Images are a tiny inline PNG answered for one fake storage host, so no storage is involved.

export const stamp = "2026-10-10T12:00:00.000Z";
export const later = "2026-10-11T09:30:00.000Z";
export const ids = {
  banner: "018f22f2-9c1a-7b21-8c45-0000000000b1",
  collection: "018f22f2-9c1a-7b21-8c45-0000000000c1",
  cover: "018f22f2-9c1a-7b21-8c45-0000000000d1",
  item: "018f22f2-9c1a-7b21-8c45-0000000000d2",
  owner: "018f22f2-9c1a-7b21-8c45-0000000000e1",
  reviewer: "018f22f2-9c1a-7b21-8c45-0000000000e2",
  submission: "018f22f2-9c1a-7b21-8c45-0000000000f1",
  waiting: "018f22f2-9c1a-7b21-8c45-0000000000f2",
};
const chain = "bip122:00000008819873e925422c1ff0f99f7c";
// A 1x1 PNG, answered for every image address below, so the page shows real images without storage.
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const imageHost = "https://storage.example.test";

const preview = (id: string, purpose: string) => ({
  createdAt: stamp,
  derivativeAccess: "available",
  derivatives: [
    {
      contentType: "image/png",
      expiresAt: "2099-01-01T00:00:00.000Z",
      heightPixels: 40,
      kind: "thumbnail",
      url: `${imageHost}/${id}.png`,
      widthPixels: 40,
    },
  ],
  fileName: null,
  heightPixels: 40,
  id,
  processingState: "processed",
  purpose,
  rejectionReason: null,
  widthPixels: 40,
});

const snapshot = {
  assets: [
    {
      contentSha256: "b".repeat(64),
      id: ids.cover,
      purpose: "collection-artwork",
    },
    {
      contentSha256: "c".repeat(64),
      id: ids.item,
      purpose: "collection-item-artwork",
    },
  ],
  collection: {
    bannerAssetId: null,
    coverAssetId: ids.cover,
    description: "A small collection of hand-drawn lights.",
    name: "First light",
    plannedSupply: 1,
    provenance: "Drawn by hand",
    targetChain: chain,
  },
  items: [
    {
      attributes: [{ trait: "Colour", value: "Blue" }],
      description: "The first light",
      id: ids.banner,
      imageAssetId: ids.item,
      name: "Dawn",
      position: 1,
    },
  ],
  schemaVersion: 1,
} as const;

const submission = (state: string, events: object[]) => ({
  collectionId: ids.collection,
  collectionRevision: 4,
  createdAt: stamp,
  events: [
    {
      action: "submit",
      actorName: "E2E creator",
      actorUserId: ids.owner,
      createdAt: stamp,
      creatorFeedback: "",
      nextState: "submitted",
      previousState: null,
      privateNotes: "",
      reasonCode: "creator-submitted",
    },
    ...events,
  ],
  id: ids.submission,
  ownerState: "approved",
  ownerUserId: ids.owner,
  payloadHash: "a".repeat(64),
  sequence: 1,
  snapshot,
  state,
  updatedAt: later,
});

export const detailBody = (state: string, events: object[]) =>
  reviewDetailResponseSchema.parse({
    previews: [
      preview(ids.cover, "collection-artwork"),
      preview(ids.item, "collection-item-artwork"),
    ],
    submission: submission(state, events),
  });

export async function answerImages(page: Page) {
  await page.route(`${imageHost}/**`, (request) =>
    request.fulfill({ body: pixel, contentType: "image/png" }),
  );
}

// Answers a read of the platform's API. A read names what it asks for in its query string, so the route matches with or without one.
export async function answer(page: Page, route: string, body: object) {
  await page.route(new RegExp(`/api/v1/${route}(\\?.*)?$`, "u"), (request) =>
    request.fulfill({
      body: JSON.stringify(body),
      contentType: "application/json",
    }),
  );
}

// A page of the activity log with fixed events, parsed through the shared contract.
export const activityBody = (more: boolean) =>
  reviewActivityResponseSchema.parse({
    items: [
      {
        action: "approve",
        actorName: "E2E reviewer",
        actorUserId: ids.reviewer,
        collectionId: ids.collection,
        collectionName: "First light",
        createdAt: later,
        eventId: "018f22f2-9c1a-7b21-8c45-0000000000a3",
        nextState: "approved",
        previousState: "under-review",
        reasonCode: "reviewer-approved",
        sequence: 1,
        submissionId: ids.submission,
      },
      {
        action: "start-review",
        actorName: "E2E reviewer",
        actorUserId: ids.reviewer,
        collectionId: ids.collection,
        collectionName: "First light",
        createdAt: stamp,
        eventId: "018f22f2-9c1a-7b21-8c45-0000000000a2",
        nextState: "under-review",
        previousState: "submitted",
        reasonCode: "reviewer-started-review",
        sequence: 1,
        submissionId: ids.submission,
      },
      {
        action: "submit",
        actorName: "E2E creator",
        actorUserId: ids.owner,
        collectionId: ids.collection,
        collectionName: "First light",
        createdAt: stamp,
        eventId: "018f22f2-9c1a-7b21-8c45-0000000000a1",
        nextState: "submitted",
        previousState: null,
        reasonCode: "creator-submitted",
        sequence: 1,
        submissionId: ids.submission,
      },
    ],
    nextCursor: more
      ? encodeActivityCursor({ createdAt: stamp, id: ids.waiting })
      : null,
  });
