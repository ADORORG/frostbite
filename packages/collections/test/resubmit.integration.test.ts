import {
  collectionReviewEvents,
  collectionSubmissions,
} from "@frostbite/database";
import { describe, expect, it } from "vitest";

import {
  database,
  repository,
  seedUser,
  submissions,
  useCollectionDatabase,
} from "./support/database.ts";
import { draft, newId } from "./support/fixtures.ts";
import {
  readyCollection,
  reviewerDecides,
  rowOf,
  submit,
  submitContext,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

describe("submitting again", () => {
  it("is refused while a submission is in review or approved", async () => {
    const seeded = await submitted();
    expect(await submit(seeded)).toEqual({
      kind: "not-submittable",
      reason: "in-review",
    });
    await reviewerDecides(seeded.submission.id, "start-review");
    await reviewerDecides(seeded.submission.id, "approve");
    expect(await submit(seeded)).toEqual({
      kind: "not-submittable",
      reason: "in-review",
    });
  });

  it("is possible after changes were requested, as a new submission with its own snapshot", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review");
    await reviewerDecides(seeded.submission.id, "request-changes", {
      creatorFeedback: "Add a banner.",
    });
    const saved = await repository.save({
      changedAt: new Date(),
      collectionId: seeded.collectionId,
      draft: draft({
        coverAssetId: seeded.cover,
        name: "Second try",
        plannedSupply: 2,
      }),
      expectedRevision: seeded.revision,
      ownerUserId: seeded.ownerUserId,
    });
    if (saved.kind !== "saved") throw new Error(`got ${saved.kind}`);
    const again = await submit(seeded, {
      expectedRevision: saved.aggregate.collection.revision,
    });
    if (again.kind !== "submitted") throw new Error(`got ${again.kind}`);
    expect(again.submission.sequence).toBe(2);
    expect((await rowOf(again.submission.id)).snapshot.collection.name).toBe(
      "Second try",
    );
    expect((await rowOf(seeded.submission.id)).snapshot.collection.name).toBe(
      "First light",
    );
    expect((await rowOf(seeded.submission.id)).state).toBe("changes-requested");
  });

  it.each(["reject", "revoke"] as const)(
    "is refused for good after a submission was ended by %s",
    async (action) => {
      const seeded = await submitted();
      await reviewerDecides(seeded.submission.id, "start-review");
      if (action === "reject") {
        await reviewerDecides(seeded.submission.id, "reject", {
          creatorFeedback: "Not suitable.",
        });
      } else {
        await reviewerDecides(seeded.submission.id, "approve");
        await reviewerDecides(seeded.submission.id, "revoke", {
          creatorFeedback: "Rights dispute.",
        });
      }
      expect(await submit(seeded)).toEqual({
        kind: "not-submittable",
        reason: "closed",
      });
    },
  );

  it("lets only one of two simultaneous submissions through", async () => {
    const ready = await readyCollection();
    const results = await Promise.all([submit(ready), submit(ready)]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "not-submittable",
      "submitted",
    ]);
    expect(await database.select().from(collectionSubmissions)).toHaveLength(1);
  });
});

describe("retrying a submission", () => {
  it("returns the same submission for the same key and request, and records nothing twice", async () => {
    const ready = await readyCollection();
    const context = submitContext(ready.ownerUserId);
    const first = await submit(ready, context);
    const second = await submit(ready, {
      ...context,
      eventId: newId(),
      submissionId: newId(),
    });
    if (first.kind !== "submitted" || second.kind !== "replayed")
      throw new Error(`got ${first.kind} then ${second.kind}`);
    expect(second.submission.id).toBe(first.submission.id);
    expect(await database.select().from(collectionSubmissions)).toHaveLength(1);
    expect(await database.select().from(collectionReviewEvents)).toHaveLength(
      1,
    );
  });

  it("refuses the same key used for different content", async () => {
    const ready = await readyCollection();
    const context = submitContext(ready.ownerUserId);
    await submit(ready, context);
    expect(
      await submit(ready, {
        ...context,
        eventId: newId(),
        requestFingerprint: "b".repeat(64),
        submissionId: newId(),
      }),
    ).toEqual({ kind: "conflict" });
  });

  it("refuses a key that already recorded a different submission's decision", async () => {
    const seeded = await submitted();
    const keyed = submitContext(seeded.ownerUserId);
    await reviewerDecides(seeded.submission.id, "start-review", {
      idempotencyKey: keyed.idempotencyKey,
    });
    const other = await readyCollection();
    expect(
      await submit(other, { idempotencyKey: keyed.idempotencyKey }),
    ).toEqual({ kind: "conflict" });
  });
});

describe("listing a collection's submissions", () => {
  it("shows the creator their own submissions newest first with decisions and no private notes", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review", {
      privateNotes: "internal only",
    });
    await reviewerDecides(seeded.submission.id, "request-changes", {
      creatorFeedback: "Please add a banner.",
      privateNotes: "internal only",
    });
    const listed = await submissions.listForOwner({
      collectionId: seeded.collectionId,
      ownerUserId: seeded.ownerUserId,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.state).toBe("changes-requested");
    expect(
      listed[0]?.decisions.map(({ action, creatorFeedback }) => [
        action,
        creatorFeedback,
      ]),
    ).toEqual([
      ["start-review", ""],
      ["request-changes", "Please add a banner."],
    ]);
    expect(JSON.stringify(listed)).not.toContain("internal only");
  });

  it("is empty for anyone but the owner", async () => {
    const seeded = await submitted();
    expect(
      await submissions.listForOwner({
        collectionId: seeded.collectionId,
        ownerUserId: await seedUser(),
      }),
    ).toEqual([]);
  });
});
