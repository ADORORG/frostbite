import {
  collectionReviewEvents,
  collectionSubmissions,
} from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  seedReviewer,
  useCollectionDatabase,
} from "./support/database.ts";
import { newId } from "./support/fixtures.ts";
import { reviewerDecides, rowOf, submitted } from "./support/submissions.ts";

useCollectionDatabase();

// The database refuses what the application never does, so a bug or a stray query cannot rewrite
// what a reviewer approved. Each statement is written directly, bypassing the repository.
const refusal = (message: string) => ({
  cause: { code: "23000", message: expect.stringContaining(message) },
});

describe("a submission is immutable", () => {
  type Row = Awaited<ReturnType<typeof rowOf>>;
  const tamperings: readonly (readonly [string, (row: Row) => Partial<Row>])[] =
    [
      [
        "snapshot",
        ({ snapshot }) => ({
          snapshot: {
            ...snapshot,
            collection: { ...snapshot.collection, name: "Tampered" },
          },
        }),
      ],
      ["payload hash", () => ({ payloadHash: "f".repeat(64) })],
      ["sequence", () => ({ sequence: 9 })],
      ["collection revision", () => ({ collectionRevision: 99 })],
      ["owner", () => ({ ownerUserId: newId() })],
      [
        "creation time",
        () => ({ createdAt: new Date("2020-01-01T00:00:00.000Z") }),
      ],
    ];

  it.each(tamperings)("refuses a change to its %s", async (_name, change) => {
    const { submission } = await submitted();
    const before = await rowOf(submission.id);
    await expect(
      database
        .update(collectionSubmissions)
        .set(change(before))
        .where(eq(collectionSubmissions.id, submission.id)),
    ).rejects.toMatchObject(refusal("immutable"));
    expect(await rowOf(submission.id)).toEqual(before);
  });

  it("allows only the review state and its timestamp to change", async () => {
    const { submission } = await submitted();
    const later = new Date("2026-10-11T00:00:00.000Z");
    await database
      .update(collectionSubmissions)
      .set({ state: "under-review", updatedAt: later })
      .where(eq(collectionSubmissions.id, submission.id));
    expect(await rowOf(submission.id)).toMatchObject({
      state: "under-review",
      updatedAt: later,
    });
  });

  it("refuses to delete a submission", async () => {
    const { submission } = await submitted();
    await expect(
      database
        .delete(collectionSubmissions)
        .where(eq(collectionSubmissions.id, submission.id)),
    ).rejects.toMatchObject(refusal("cannot be deleted"));
    expect(await rowOf(submission.id)).toBeDefined();
  });
});

describe("the review record is append-only", () => {
  it("refuses to change or delete an event", async () => {
    const { submission } = await submitted();
    await reviewerDecides(submission.id, "start-review");
    await expect(
      database
        .update(collectionReviewEvents)
        .set({ creatorFeedback: "Rewritten history" })
        .where(eq(collectionReviewEvents.submissionId, submission.id)),
    ).rejects.toMatchObject(refusal("append-only"));
    await expect(
      database
        .delete(collectionReviewEvents)
        .where(eq(collectionReviewEvents.submissionId, submission.id)),
    ).rejects.toMatchObject(refusal("append-only"));
    expect(
      await database
        .select()
        .from(collectionReviewEvents)
        .where(eq(collectionReviewEvents.submissionId, submission.id)),
    ).toHaveLength(2);
  });
});

describe("the database also holds the structural rules", () => {
  it("refuses a second live submission of one collection even if the application did not", async () => {
    const { submission } = await submitted();
    const row = await rowOf(submission.id);
    await expect(
      database.insert(collectionSubmissions).values({
        ...row,
        id: newId(),
        sequence: row.sequence + 1,
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("refuses a duplicate sequence, and a hash that is not a SHA-256", async () => {
    const { submission } = await submitted();
    const row = await rowOf(submission.id);
    await expect(
      database
        .insert(collectionSubmissions)
        .values({ ...row, id: newId(), state: "rejected" }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    await expect(
      database.insert(collectionSubmissions).values({
        ...row,
        id: newId(),
        payloadHash: "nope",
        sequence: 2,
        state: "rejected",
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("requires a previous state on every event but the submit event", async () => {
    const { submission } = await submitted();
    const [event] = await database.select().from(collectionReviewEvents);
    if (event === undefined) throw new Error("no event");
    await expect(
      database.insert(collectionReviewEvents).values({
        ...event,
        action: "approve",
        actorUserId: await seedReviewer(),
        id: newId(),
        idempotencyKey: "another-request-key-001",
        previousState: null,
        submissionId: submission.id,
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("records the policy version each event was decided under, whatever it is, but never a blank one", async () => {
    const { submission } = await submitted();
    const [event] = await database.select().from(collectionReviewEvents);
    if (event === undefined) throw new Error("no event");
    const reviewer = await seedReviewer();
    const next = (policyVersion: string) =>
      database.insert(collectionReviewEvents).values({
        ...event,
        action: "start-review",
        actorUserId: reviewer,
        id: newId(),
        idempotencyKey: `another-request-key-${policyVersion.length}`,
        policyVersion,
        previousState: "submitted",
        submissionId: submission.id,
      });
    await expect(next("collection-review-beta-v2")).resolves.toBeDefined();
    await expect(next("  ")).rejects.toMatchObject({
      cause: { code: "23514" },
    });
  });
});
