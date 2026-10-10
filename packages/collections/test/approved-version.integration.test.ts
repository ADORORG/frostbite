import { collectionSubmissions } from "@ador/database";
import { expectToWait, holdTransaction } from "@ador/test-kit/race";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { lockApprovedVersion } from "../src/adapters/approved-version.ts";
import {
  approvedVersions,
  database,
  seedReviewer,
  setApplicationState,
  useCollectionDatabase,
} from "./support/database.ts";
import { newId } from "./support/fixtures.ts";
import {
  decide,
  readyCollection,
  reviewerDecides,
  rowOf,
  submit,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

// A submission taken through review to approval, with the time the approval was recorded.
async function approved() {
  const seeded = await submitted();
  const reviewer = await seedReviewer();
  await decide(seeded.submission.id, reviewer, "start-review");
  const result = await decide(seeded.submission.id, reviewer, "approve");
  if (result.kind !== "decided") throw new Error(`got ${result.kind}`);
  return { ...seeded, reviewer };
}

const held = (collectionId: string) =>
  database.transaction((transaction) =>
    lockApprovedVersion(transaction, collectionId),
  );

describe("the approved version", () => {
  it("is the approved submission, with its snapshot, hash, sequence, and the time it was approved", async () => {
    const seeded = await approved();
    const row = await rowOf(seeded.submission.id);
    const version = await approvedVersions.findApprovedVersion(
      seeded.collectionId,
    );
    expect(version).toMatchObject({
      collectionId: seeded.collectionId,
      ownerUserId: seeded.ownerUserId,
      payloadHash: row.payloadHash,
      sequence: 1,
      snapshot: row.snapshot,
      submissionId: seeded.submission.id,
    });
    expect(version?.approvedAt).toBeInstanceOf(Date);
    expect(await held(seeded.collectionId)).toEqual(version);
  });

  it.each(["submitted", "under-review"] as const)(
    "is nothing while the submission is %s",
    async (state) => {
      const seeded = await submitted();
      if (state === "under-review")
        await reviewerDecides(seeded.submission.id, "start-review");
      expect(
        await approvedVersions.findApprovedVersion(seeded.collectionId),
      ).toBeNull();
      expect(await held(seeded.collectionId)).toBeNull();
    },
  );

  it.each(["request-changes", "reject"] as const)(
    "is nothing after a review ends in %s",
    async (action) => {
      const seeded = await submitted();
      await reviewerDecides(seeded.submission.id, "start-review");
      await reviewerDecides(seeded.submission.id, action, {
        creatorFeedback: "Words.",
      });
      expect(
        await approvedVersions.findApprovedVersion(seeded.collectionId),
      ).toBeNull();
      expect(await held(seeded.collectionId)).toBeNull();
    },
  );

  it.each(["suspend", "revoke"] as const)(
    "is nothing once an approved submission is %sed",
    async (action) => {
      const seeded = await approved();
      await decide(seeded.submission.id, seeded.reviewer, action, {
        creatorFeedback: "Words.",
      });
      expect(
        await approvedVersions.findApprovedVersion(seeded.collectionId),
      ).toBeNull();
      expect(await held(seeded.collectionId)).toBeNull();
    },
  );

  it("comes back when a suspended approval is reinstated", async () => {
    const seeded = await approved();
    await decide(seeded.submission.id, seeded.reviewer, "suspend", {
      creatorFeedback: "Looking into it.",
    });
    await decide(seeded.submission.id, seeded.reviewer, "reinstate");
    expect(
      (await approvedVersions.findApprovedVersion(seeded.collectionId))
        ?.submissionId,
    ).toBe(seeded.submission.id);
  });

  it.each(["suspended", "revoked", "rejected", "draft"] as const)(
    "is nothing when the creator is %s, whatever the submission row says",
    async (creatorState) => {
      const seeded = await approved();
      await setApplicationState(seeded.ownerUserId, creatorState);
      expect((await rowOf(seeded.submission.id)).state).toBe("approved");
      expect(
        await approvedVersions.findApprovedVersion(seeded.collectionId),
      ).toBeNull();
      expect(await held(seeded.collectionId)).toBeNull();
    },
  );

  it("is the newest approval when a collection has had several submissions", async () => {
    const first = await submitted();
    const reviewer = await seedReviewer();
    await decide(first.submission.id, reviewer, "start-review");
    await decide(first.submission.id, reviewer, "request-changes", {
      creatorFeedback: "More.",
    });
    const second = await submit(first, { expectedRevision: first.revision });
    if (second.kind !== "submitted") throw new Error(`got ${second.kind}`);
    await decide(second.submission.id, reviewer, "start-review");
    await decide(second.submission.id, reviewer, "approve");
    const version = await approvedVersions.findApprovedVersion(
      first.collectionId,
    );
    expect([version?.submissionId, version?.sequence]).toEqual([
      second.submission.id,
      2,
    ]);
  });

  it("is nothing for a collection that was never submitted, or does not exist", async () => {
    const ready = await readyCollection();
    expect(
      await approvedVersions.findApprovedVersion(ready.collectionId),
    ).toBeNull();
    expect(await approvedVersions.findApprovedVersion(newId())).toBeNull();
    expect(await held(newId())).toBeNull();
  });

  it("fails loudly if an approved submission has no approval event, rather than inventing a time", async () => {
    const seeded = await submitted();
    await database
      .update(collectionSubmissions)
      .set({ state: "approved" })
      .where(eq(collectionSubmissions.id, seeded.submission.id));
    await expect(
      approvedVersions.findApprovedVersion(seeded.collectionId),
    ).rejects.toThrow("has no approval event");
  });
});

describe("acting on the approved version", () => {
  it("makes a revocation in flight wait until the caller has finished, then lands after it", async () => {
    const seeded = await approved();
    const holder = await holdTransaction(database, async (transaction) => {
      expect(
        await lockApprovedVersion(transaction, seeded.collectionId),
      ).not.toBeNull();
    });
    const result = await expectToWait(holder, () =>
      decide(seeded.submission.id, seeded.reviewer, "revoke", {
        creatorFeedback: "Rights dispute.",
      }),
    );
    expect(result.kind).toBe("decided");
    expect(
      await approvedVersions.findApprovedVersion(seeded.collectionId),
    ).toBeNull();
  });

  it("makes a suspension of the creator in flight wait until the caller has finished", async () => {
    const seeded = await approved();
    const holder = await holdTransaction(database, async (transaction) => {
      expect(
        await lockApprovedVersion(transaction, seeded.collectionId),
      ).not.toBeNull();
    });
    await expectToWait(holder, () =>
      setApplicationState(seeded.ownerUserId, "suspended"),
    );
    expect(
      await approvedVersions.findApprovedVersion(seeded.collectionId),
    ).toBeNull();
  });

  it("sees a revocation that committed first, and does not act", async () => {
    const seeded = await approved();
    const revocation = await holdTransaction(database, (transaction) =>
      transaction
        .update(collectionSubmissions)
        .set({ state: "revoked" })
        .where(eq(collectionSubmissions.id, seeded.submission.id)),
    );
    const version = await expectToWait(revocation, () =>
      held(seeded.collectionId),
    );
    expect(version).toBeNull();
  });
});
