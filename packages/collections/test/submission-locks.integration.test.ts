import { collectionSubmissions } from "@ador/database";
import { expectToWait, holdTransaction } from "@ador/test-kit/race";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { lockIdempotencyKey } from "../src/adapters/guards.ts";
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
  submit,
  submitContext,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

describe("requests that share an idempotency key", () => {
  it("make a submission wait while another request holds the key, then replay or refuse it", async () => {
    const ready = await readyCollection();
    const context = submitContext(ready.ownerUserId);
    const holder = await holdTransaction(database, (transaction) =>
      lockIdempotencyKey(transaction, context.idempotencyKey),
    );
    const result = await expectToWait(holder, () => submit(ready, context));
    expect(result.kind).toBe("submitted");
  });

  it("make a decision wait while another request holds the key", async () => {
    const seeded = await submitted();
    const reviewer = await seedReviewer();
    const context = submitContext(reviewer);
    const holder = await holdTransaction(database, (transaction) =>
      lockIdempotencyKey(transaction, context.idempotencyKey),
    );
    const result = await expectToWait(holder, () =>
      decide(seeded.submission.id, reviewer, "start-review", context),
    );
    expect(result.kind).toBe("decided");
  });

  it("refuse the same key on another of the creator's collections even with the same fingerprint", async () => {
    const first = await readyCollection();
    const second = await readyCollection(2, first.ownerUserId);
    const context = submitContext(first.ownerUserId);
    expect((await submit(first, context)).kind).toBe("submitted");
    expect(
      await submit(second, {
        ...context,
        eventId: newId(),
        submissionId: newId(),
      }),
    ).toEqual({ kind: "conflict" });
  });
});

describe("a decision on one submission", () => {
  it("waits while the submission is locked by another change", async () => {
    const seeded = await submitted();
    const holder = await holdTransaction(database, (transaction) =>
      transaction
        .select()
        .from(collectionSubmissions)
        .where(eq(collectionSubmissions.id, seeded.submission.id))
        .for("update"),
    );
    const result = await expectToWait(holder, () =>
      reviewerDecides(seeded.submission.id, "start-review"),
    );
    expect(result.kind).toBe("decided");
  });

  it("is judged against the state another change leaves, not the one it started from", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review");
    // Another decision approves the submission and has not committed yet.
    const holder = await holdTransaction(database, (transaction) =>
      transaction
        .update(collectionSubmissions)
        .set({ state: "approved" })
        .where(eq(collectionSubmissions.id, seeded.submission.id)),
    );
    const result = await expectToWait(holder, () =>
      reviewerDecides(seeded.submission.id, "reject", {
        creatorFeedback: "Not suitable.",
      }),
    );
    expect(result).toEqual({ kind: "invalid-transition", state: "approved" });
  });
});

describe("reads that tie on time", () => {
  it("keep the queue in id order when changes share an instant", async () => {
    const [low, high] = [newId(), newId()].sort();
    if (low === undefined || high === undefined) throw new Error("no ids");
    // The higher id is written first, so storage order differs from id order.
    const later = await readyCollection();
    const earlier = await readyCollection();
    await submit(later, { changedAt: now, submissionId: high });
    await submit(earlier, { changedAt: now, submissionId: low });
    const queue = await submissions.queue({ limit: 10, states: ["submitted"] });
    expect(queue.map(({ id }) => id)).toEqual([low, high]);
  });

  it("keep a submission's events in id order when they share an instant", async () => {
    const [low, high] = [newId(), newId()].sort();
    if (low === undefined || high === undefined) throw new Error("no ids");
    // The submit event gets the higher id and is written first, so storage order is the opposite of id
    // order: only an explicit tie-break on id can put the lower-id event first.
    const ready = await readyCollection();
    const result = await submit(ready, { changedAt: now, eventId: high });
    if (result.kind !== "submitted") throw new Error(`got ${result.kind}`);
    await decide(result.submission.id, await seedReviewer(), "start-review", {
      changedAt: now,
      eventId: low,
    });
    const view = await submissions.readForReview(result.submission.id);
    expect(view?.events.map(({ action }) => action)).toEqual([
      "start-review",
      "submit",
    ]);
  });
});
