import {
  collectionItems,
  collectionReviewEvents,
  collectionSubmissions,
  collections,
  type DatabaseClient,
} from "@ador/database";
import { submissionSnapshotSchema } from "@ador/shared/collections";
import { requestFingerprint } from "@ador/shared/http";
import { seedUploadedAsset } from "@ador/test-kit/creator-database";

import {
  creatorE2EFixtures,
  publicCollection,
} from "../src/creator-fixtures.ts";

const chain = "bip122:00000008819873e925422c1ff0f99f7c";
const at = new Date("2026-10-10T12:00:00.000Z");
const approvedAt = new Date("2026-10-11T09:30:00.000Z");
const owner = creatorE2EFixtures.publicCollectionCreator.userId;
const reviewer = creatorE2EFixtures.reviewer.userId;
const fingerprint = "a".repeat(64);
const id = (suffix: number) =>
  `01994b10-0000-7000-8000-0000000000${suffix.toString(16)}`;

// An approved collection with fixed content, written directly (no review flow), so the public pages
// can be checked in a known state. Its images are processed assets without renditions, so the pages
// show their "preview unavailable" state, which is stable and is itself a state worth checking.
export async function seedPublicCollection(database: DatabaseClient) {
  const cover = await seedUploadedAsset(database, {
    now: at,
    purpose: "collection-artwork",
    userId: owner,
  });
  const image = await seedUploadedAsset(database, {
    now: at,
    purpose: "collection-item-artwork",
    userId: owner,
  });
  await database.insert(collections).values({
    chainId: chain,
    coverAssetId: cover,
    description: "A small collection of hand-drawn lights.",
    id: publicCollection.id,
    idempotencyKey: "public-collection-seed-key",
    name: publicCollection.name,
    ownerUserId: owner,
    plannedSupply: 1,
    provenance: "Drawn by hand",
    requestFingerprint: fingerprint,
  });
  await database.insert(collectionItems).values({
    attributes: [{ trait: "Colour", value: "Blue" }],
    collectionId: publicCollection.id,
    description: "The first light",
    id: id(0x51),
    idempotencyKey: "public-collection-seed-item",
    imageAssetId: image,
    name: "Dawn",
    position: 1,
    requestFingerprint: fingerprint,
  });
  const snapshot = submissionSnapshotSchema.parse({
    assets: [
      {
        contentSha256: "b".repeat(64),
        id: cover,
        purpose: "collection-artwork",
      },
      {
        contentSha256: "c".repeat(64),
        id: image,
        purpose: "collection-item-artwork",
      },
    ],
    collection: {
      bannerAssetId: null,
      coverAssetId: cover,
      description: "A small collection of hand-drawn lights.",
      name: publicCollection.name,
      plannedSupply: 1,
      provenance: "Drawn by hand",
      targetChain: chain,
    },
    items: [
      {
        attributes: [{ trait: "Colour", value: "Blue" }],
        description: "The first light",
        id: id(0x51),
        imageAssetId: image,
        name: "Dawn",
        position: 1,
      },
    ],
    schemaVersion: 1,
  });
  await database.insert(collectionSubmissions).values({
    collectionId: publicCollection.id,
    collectionRevision: 1,
    createdAt: at,
    id: id(0x52),
    ownerUserId: owner,
    payloadHash: requestFingerprint(snapshot),
    schemaVersion: 1,
    sequence: 1,
    snapshot,
    state: "approved",
    updatedAt: approvedAt,
  });
  const event = (
    n: number,
    action: "approve" | "start-review" | "submit",
    previous: "submitted" | "under-review" | null,
    next: "approved" | "submitted" | "under-review",
    when: Date,
  ) => ({
    action,
    actorUserId: action === "submit" ? owner : reviewer,
    correlationId: id(0x60 + n),
    createdAt: when,
    id: id(0x70 + n),
    idempotencyKey: `public-collection-seed-event-${String(n)}`,
    nextState: next,
    policyVersion: "collection-review-beta-v1",
    previousState: previous,
    reasonCode: "seeded-for-checks",
    requestFingerprint: fingerprint,
    submissionId: id(0x52),
  });
  await database
    .insert(collectionReviewEvents)
    .values([
      event(1, "submit", null, "submitted", at),
      event(2, "start-review", "submitted", "under-review", at),
      event(3, "approve", "under-review", "approved", approvedAt),
    ]);
}
