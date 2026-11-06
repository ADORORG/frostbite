import { collectionSubmissions } from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  approvedVersions,
  database,
  repository,
  setApplicationState,
  useCollectionDatabase,
} from "./support/database.ts";
import { draft } from "./support/fixtures.ts";
import {
  approvedSubmission,
  decide,
  reviewerDecides,
  rowOf,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

describe("listing approved collections", () => {
  it("is empty when nothing has been approved", async () => {
    await submitted();
    expect(await approvedVersions.listApprovedCollections(10)).toEqual([]);
  });

  it("lists an approved collection from its frozen snapshot, not the draft", async () => {
    const seeded = await approvedSubmission();
    const row = await rowOf(seeded.submission.id);
    const saved = await repository.save({
      changedAt: new Date(),
      collectionId: seeded.collectionId,
      draft: draft({
        coverAssetId: seeded.cover,
        name: "Renamed after approval",
        plannedSupply: 2,
      }),
      expectedRevision: seeded.revision,
      ownerUserId: seeded.ownerUserId,
    });
    expect(saved.kind).toBe("saved");
    const [listed] = await approvedVersions.listApprovedCollections(10);
    expect(listed).toMatchObject({
      collectionId: seeded.collectionId,
      coverAssetId: seeded.cover,
      description: row.snapshot.collection.description,
      itemCount: 2,
      name: "First light",
      ownerUserId: seeded.ownerUserId,
      plannedSupply: 2,
      targetChain: row.snapshot.collection.targetChain,
    });
    expect(listed?.approvedAt).toBeInstanceOf(Date);
  });

  it("lists newest approval first, and no more than the limit", async () => {
    const older = await approvedSubmission();
    const newer = await approvedSubmission();
    await database
      .update(collectionSubmissions)
      .set({ updatedAt: new Date("2026-10-12T00:00:00.000Z") })
      .where(eq(collectionSubmissions.id, newer.submission.id));
    const both = await approvedVersions.listApprovedCollections(10);
    expect(both.map(({ collectionId }) => collectionId)).toEqual([
      newer.collectionId,
      older.collectionId,
    ]);
    expect(await approvedVersions.listApprovedCollections(1)).toHaveLength(1);
  });

  it("leaves out everything that is not currently approved: submitted, in review, finished, suspended, revoked", async () => {
    await submitted();
    const inReview = await submitted();
    await reviewerDecides(inReview.submission.id, "start-review");
    const changes = await submitted();
    await reviewerDecides(changes.submission.id, "start-review");
    await reviewerDecides(changes.submission.id, "request-changes", {
      creatorFeedback: "More.",
    });
    const rejected = await submitted();
    await reviewerDecides(rejected.submission.id, "start-review");
    await reviewerDecides(rejected.submission.id, "reject", {
      creatorFeedback: "No.",
    });
    const suspended = await approvedSubmission();
    await decide(suspended.submission.id, suspended.reviewer, "suspend", {
      creatorFeedback: "Looking.",
    });
    const revoked = await approvedSubmission();
    await decide(revoked.submission.id, revoked.reviewer, "revoke", {
      creatorFeedback: "Rights.",
    });
    expect(await approvedVersions.listApprovedCollections(10)).toEqual([]);
  });

  it("leaves out a collection whose creator is no longer approved, and brings it back with the creator", async () => {
    const seeded = await approvedSubmission();
    await setApplicationState(seeded.ownerUserId, "suspended");
    expect(await approvedVersions.listApprovedCollections(10)).toEqual([]);
    await setApplicationState(seeded.ownerUserId, "approved");
    expect(await approvedVersions.listApprovedCollections(10)).toHaveLength(1);
  });
});
