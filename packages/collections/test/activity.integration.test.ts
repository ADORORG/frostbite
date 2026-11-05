import { describe, expect, it } from "vitest";

import {
  database,
  seedReviewer,
  setApplicationState,
  submissions,
  useCollectionDatabase,
} from "./support/database.ts";
import { newId, now } from "./support/fixtures.ts";
import {
  approvedSubmission,
  decide,
  readyCollection,
  reviewerDecides,
  submit,
  submitted,
} from "./support/submissions.ts";
import { authUsers, creatorApplications } from "@frostbite/database";
import { eq } from "drizzle-orm";

useCollectionDatabase();

const at = (seconds: number) => new Date(now.getTime() + seconds * 1_000);

describe("the activity log", () => {
  it("is empty before anything happened", async () => {
    expect(await submissions.activity({ cursor: null, limit: 10 })).toEqual({
      items: [],
      next: null,
    });
  });

  it("lists every event of every submission, newest first, with who acted and what changed", async () => {
    const first = await readyCollection();
    const second = await readyCollection();
    await submit(first, { changedAt: at(1) });
    const queued = await submit(second, { changedAt: at(2) });
    if (queued.kind !== "submitted") throw new Error(`got ${queued.kind}`);
    const reviewer = await seedReviewer();
    await database
      .update(authUsers)
      .set({ name: "Rita Reviewer" })
      .where(eq(authUsers.id, reviewer));
    await decide(queued.submission.id, reviewer, "start-review", {
      changedAt: at(3),
    });
    const { items, next } = await submissions.activity({
      cursor: null,
      limit: 10,
    });
    expect(next).toBeNull();
    expect(items.map(({ action }) => action)).toEqual([
      "start-review",
      "submit",
      "submit",
    ]);
    expect(items[0]).toMatchObject({
      actorName: "Rita Reviewer",
      actorUserId: reviewer,
      collectionId: second.collectionId,
      collectionName: "First light",
      nextState: "under-review",
      previousState: "submitted",
      reasonCode: "reviewed-by-staff",
      sequence: 1,
      submissionId: queued.submission.id,
    });
    expect(items[1]).toMatchObject({
      actorUserId: second.ownerUserId,
      previousState: null,
      nextState: "submitted",
    });
  });

  it("never carries private notes or the feedback written for the creator", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review", {
      privateNotes: "secret note",
    });
    await reviewerDecides(seeded.submission.id, "request-changes", {
      creatorFeedback: "feedback words",
      privateNotes: "another secret",
    });
    const text = JSON.stringify(
      await submissions.activity({ cursor: null, limit: 10 }),
    );
    for (const hidden of ["secret note", "another secret", "feedback words"])
      expect(text).not.toContain(hidden);
  });

  it("is cut into pages at the last event seen, with no event missed or repeated", async () => {
    await approvedSubmission();
    const all = await submissions.activity({ cursor: null, limit: 50 });
    expect(all.items).toHaveLength(3);
    const pages: string[] = [];
    let cursor = null;
    for (let page = 0; page < 5; page += 1) {
      const result: Awaited<ReturnType<typeof submissions.activity>> =
        await submissions.activity({ cursor, limit: 2 });
      pages.push(...result.items.map(({ eventId }) => eventId));
      if (result.next === null) break;
      cursor = result.next;
    }
    expect(pages).toEqual(all.items.map(({ eventId }) => eventId));
    expect(
      (await submissions.activity({ cursor: null, limit: 2 })).next,
    ).not.toBeNull();
    expect(
      (await submissions.activity({ cursor: null, limit: 3 })).next,
    ).toBeNull();
  });

  it("keeps a stable order when events share an instant, by id", async () => {
    const first = await readyCollection();
    const second = await readyCollection();
    const [low, high] = [newId(), newId()].sort();
    if (low === undefined || high === undefined) throw new Error("no ids");
    await submit(first, { changedAt: now, eventId: high });
    await submit(second, { changedAt: now, eventId: low });
    const { items } = await submissions.activity({ cursor: null, limit: 10 });
    expect(items.map(({ eventId }) => eventId)).toEqual([high, low]);
  });
});

describe("a submission as staff read it", () => {
  it("names who acted on each event and shows the creator's standing now", async () => {
    const seeded = await approvedSubmission();
    const view = await submissions.readForReview(seeded.submission.id);
    expect(view?.ownerState).toBe("approved");
    expect(
      view?.events
        .map(({ actorName }) => actorName)
        .every((name) => name !== ""),
    ).toBe(true);
    await setApplicationState(seeded.ownerUserId, "suspended");
    expect(
      (await submissions.readForReview(seeded.submission.id))?.ownerState,
    ).toBe("suspended");
  });

  it("shows no standing for a creator who never applied", async () => {
    const seeded = await submitted();
    await database.delete(creatorApplications);
    expect(
      (await submissions.readForReview(seeded.submission.id))?.ownerState,
    ).toBeNull();
  });
});
