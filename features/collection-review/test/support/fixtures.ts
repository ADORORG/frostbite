import {
  encodeActivityCursor,
  type ReviewActivityItem,
  type ReviewDetailResponse,
  ReviewEvent,
  ReviewQueueItem,
  ReviewSubmission,
  SubmissionState,
} from "@ador/shared/collections";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { libraryAssetFixture } from "@ador/test-kit/library-asset";

export const id = () => uuidV7Schema.parse(createUuidV7());
export const signet = "bip122:00000008819873e925422c1ff0f99f7c";
export const stamp = "2026-10-10T12:00:00.000Z";

const cover = id();
const itemImage = id();
const owner = id();
const reviewer = id();

export const previews = [
  libraryAssetFixture("collection-artwork", cover),
  libraryAssetFixture("collection-item-artwork", itemImage),
];

export const event = (
  action: ReviewEvent["action"],
  overrides: Partial<ReviewEvent> = {},
): ReviewEvent => ({
  action,
  actorName: action === "submit" ? "Creator Crea" : "Rita Reviewer",
  actorUserId: action === "submit" ? owner : reviewer,
  createdAt: stamp,
  creatorFeedback: "",
  nextState: "submitted",
  previousState: null,
  privateNotes: "",
  reasonCode: "creator-submitted",
  ...overrides,
});

// A submission as staff read it: the frozen snapshot, its hash, and the history so far.
export function reviewSubmission(
  state: SubmissionState = "submitted",
  overrides: Partial<ReviewSubmission> = {},
): ReviewSubmission {
  return {
    collectionId: id(),
    collectionRevision: 4,
    createdAt: stamp,
    events: [event("submit")],
    id: id(),
    ownerState: "approved",
    ownerUserId: owner,
    payloadHash: "a".repeat(64),
    sequence: 1,
    snapshot: {
      assets: [
        {
          contentSha256: "b".repeat(64),
          id: cover,
          purpose: "collection-artwork",
        },
        {
          contentSha256: "c".repeat(64),
          id: itemImage,
          purpose: "collection-item-artwork",
        },
      ],
      collection: {
        bannerAssetId: null,
        coverAssetId: cover,
        description: "A small collection of hand-drawn lights.",
        name: "First light",
        plannedSupply: 1,
        provenance: "Drawn by hand",
        targetChain: signet,
      },
      items: [
        {
          attributes: [{ trait: "Colour", value: "Blue" }],
          description: "The first light",
          id: id(),
          imageAssetId: itemImage,
          name: "Dawn",
          position: 1,
        },
      ],
      schemaVersion: 1,
    },
    state,
    updatedAt: stamp,
    ...overrides,
  };
}

export const detailOf = (
  submission: ReviewSubmission = reviewSubmission(),
): ReviewDetailResponse => ({ previews, submission });

export const queueItem = (
  state: SubmissionState = "submitted",
  overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem => ({
  collectionId: id(),
  collectionName: "First light",
  createdAt: stamp,
  id: id(),
  sequence: 1,
  state,
  updatedAt: stamp,
  ...overrides,
});

export const activityItem = (
  overrides: Partial<ReviewActivityItem> = {},
): ReviewActivityItem => ({
  action: "start-review",
  actorName: "Rita Reviewer",
  actorUserId: reviewer,
  collectionId: id(),
  collectionName: "First light",
  createdAt: stamp,
  eventId: id(),
  nextState: "under-review",
  previousState: "submitted",
  reasonCode: "reviewer-started-review",
  sequence: 1,
  submissionId: id(),
  ...overrides,
});

// The cursor the real log would hand out after `item`.
export const cursorAfter = (item: ReviewActivityItem) =>
  encodeActivityCursor({ createdAt: item.createdAt, id: item.eventId });
