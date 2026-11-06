import { collectionReviewEvents } from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  seedReviewer,
  submissions,
  useCollectionDatabase,
} from "./support/database.ts";
import { newId, now } from "./support/fixtures.ts";
import {
  decide,
  readyCollection,
  reviewerDecides,
  rowOf,
  submit,
  submitContext,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

const stateOf = async (id: Parameters<typeof rowOf>[0]) =>
  (await rowOf(id)).state;

describe("retrying a decision", () => {
  it("returns the recorded decision for the same key and request, recording nothing twice", async () => {
    const seeded = await submitted();
    const reviewer = await seedReviewer();
    const context = submitContext(reviewer);
    const first = await decide(
      seeded.submission.id,
      reviewer,
      "start-review",
      context,
    );
    const second = await decide(
      seeded.submission.id,
      reviewer,
      "start-review",
      { ...context, eventId: newId() },
    );
    expect([first.kind, second.kind]).toEqual(["decided", "replayed"]);
    expect(
      await database
        .select()
        .from(collectionReviewEvents)
        .where(eq(collectionReviewEvents.submissionId, seeded.submission.id)),
    ).toHaveLength(2);
    expect(await stateOf(seeded.submission.id)).toBe("under-review");
  });

  it("refuses the same key for different content, and another reviewer's replay of it", async () => {
    const seeded = await submitted();
    const reviewer = await seedReviewer();
    const context = submitContext(reviewer);
    await decide(seeded.submission.id, reviewer, "start-review", context);
    expect(
      await decide(seeded.submission.id, reviewer, "start-review", {
        ...context,
        eventId: newId(),
        requestFingerprint: "c".repeat(64),
      }),
    ).toEqual({ kind: "conflict" });
    expect(
      await decide(seeded.submission.id, await seedReviewer(), "start-review", {
        ...context,
        eventId: newId(),
        requestFingerprint: "d".repeat(64),
      }),
    ).toEqual({ kind: "conflict" });
  });

  it("lets only one of two simultaneous decisions on one submission win", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review");
    const results = await Promise.all([
      reviewerDecides(seeded.submission.id, "approve"),
      reviewerDecides(seeded.submission.id, "reject", {
        creatorFeedback: "No.",
      }),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "decided",
      "invalid-transition",
    ]);
  });
});

describe("the review queue and the staff view", () => {
  it("lists submissions in the chosen states, oldest update first, with the collection name", async () => {
    const first = await submitted();
    const second = await submitted();
    await reviewerDecides(second.submission.id, "start-review");
    const waiting = await submissions.queue({
      limit: 10,
      states: ["submitted"],
    });
    expect(waiting.map(({ id }) => id)).toEqual([first.submission.id]);
    expect(waiting[0]?.collectionName).toBe("First light");
    const both = await submissions.queue({
      limit: 10,
      states: ["submitted", "under-review"],
    });
    expect(both.map(({ id }) => id)).toEqual([
      first.submission.id,
      second.submission.id,
    ]);
    expect(
      await submissions.queue({
        limit: 1,
        states: ["submitted", "under-review"],
      }),
    ).toHaveLength(1);
    expect(
      await submissions.queue({ limit: 10, states: ["approved"] }),
    ).toEqual([]);
  });

  it("orders by time of last change, not by when the submission was made", async () => {
    const earlier = await readyCollection();
    const later = await readyCollection();
    const at = (seconds: number) => new Date(now.getTime() + seconds * 1_000);
    const second = await submit(later, { changedAt: at(1) });
    const first = await submit(earlier, { changedAt: at(2) });
    if (first.kind !== "submitted" || second.kind !== "submitted")
      throw new Error("expected both to be submitted");
    const queue = await submissions.queue({ limit: 10, states: ["submitted"] });
    expect(queue.map(({ id }) => id)).toEqual([
      second.submission.id,
      first.submission.id,
    ]);
  });

  it("shows staff the snapshot and every event including private notes, and nothing for an unknown id", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review", {
      privateNotes: "Looks fine.",
    });
    const view = await submissions.readForReview(seeded.submission.id);
    expect(view?.snapshot.items).toHaveLength(2);
    expect(
      view?.events.map(({ action, privateNotes }) => [action, privateNotes]),
    ).toEqual([
      ["submit", ""],
      ["start-review", "Looks fine."],
    ]);
    expect(await submissions.readForReview(newId())).toBeNull();
  });
});
