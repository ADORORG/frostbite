import { describe, expect, it } from "vitest";

import {
  repository,
  seedUser,
  useCollectionDatabase,
} from "./support/database.ts";
import { draft, mutation, newId } from "./support/fixtures.ts";
import {
  readyCollection,
  reviewerDecides,
  submit,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

const stateOf = async (
  ownerUserId: Parameters<typeof mutation>[0],
  id: string,
) =>
  (await repository.listForOwner({ limit: 10, ownerUserId })).find(
    (summary) => summary.id === id,
  )?.submissionState;

describe("a creator's list shows where each collection stands", () => {
  it("lists nothing for a creator with no collections", async () => {
    const owner = await seedUser();
    expect(
      await repository.listForOwner({ limit: 10, ownerUserId: owner }),
    ).toEqual([]);
  });

  it("carries the cover image of each collection, or none while none is chosen", async () => {
    const ready = await readyCollection();
    const [summary] = await repository.listForOwner({
      limit: 10,
      ownerUserId: ready.ownerUserId,
    });
    expect(summary?.coverAssetId).toBe(ready.cover);
    const created = await repository.create({
      ...mutation(ready.ownerUserId),
      collectionId: newId(),
      draft: draft({ coverAssetId: null }),
    });
    expect(created.kind).toBe("created");
    const covers = (
      await repository.listForOwner({
        limit: 10,
        ownerUserId: ready.ownerUserId,
      })
    ).map(({ coverAssetId }) => coverAssetId);
    expect(covers).toHaveLength(2);
    expect(covers).toContain(null);
    expect(covers).toContain(ready.cover);
  });

  it("has no state for a draft that was never submitted", async () => {
    const ready = await readyCollection();
    expect(await stateOf(ready.ownerUserId, ready.collectionId)).toBeNull();
  });

  it("shows the state of the submission, and follows the reviewer's decisions", async () => {
    const seeded = await submitted();
    expect(await stateOf(seeded.ownerUserId, seeded.collectionId)).toBe(
      "submitted",
    );
    await reviewerDecides(seeded.submission.id, "start-review");
    expect(await stateOf(seeded.ownerUserId, seeded.collectionId)).toBe(
      "under-review",
    );
    await reviewerDecides(seeded.submission.id, "request-changes", {
      creatorFeedback: "Add a banner.",
    });
    expect(await stateOf(seeded.ownerUserId, seeded.collectionId)).toBe(
      "changes-requested",
    );
  });

  it("counts only the newest submission once the collection was revised and submitted again", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review");
    await reviewerDecides(seeded.submission.id, "request-changes", {
      creatorFeedback: "Add a banner.",
    });
    const saved = await repository.save({
      changedAt: new Date(),
      collectionId: seeded.collectionId,
      draft: draft({ coverAssetId: seeded.cover, plannedSupply: 2 }),
      expectedRevision: seeded.revision,
      ownerUserId: seeded.ownerUserId,
    });
    if (saved.kind !== "saved") throw new Error(`got ${saved.kind}`);
    const again = await submit(seeded, {
      expectedRevision: saved.aggregate.collection.revision,
    });
    if (again.kind !== "submitted") throw new Error(`got ${again.kind}`);
    expect(await stateOf(seeded.ownerUserId, seeded.collectionId)).toBe(
      "submitted",
    );
  });

  it("keeps each collection's state apart, and never shows another creator's", async () => {
    const first = await submitted();
    const second = await readyCollection();
    const list = await repository.listForOwner({
      limit: 10,
      ownerUserId: first.ownerUserId,
    });
    expect(list.map(({ submissionState }) => submissionState)).toEqual([
      "submitted",
    ]);
    expect(await stateOf(second.ownerUserId, second.collectionId)).toBeNull();
  });
});
