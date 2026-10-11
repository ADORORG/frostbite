import {
  collectionReviewEvents,
  platformRoleAssignments,
} from "@ador/database";
import { requestFingerprint } from "@ador/shared/http";
import { describe, expect, it } from "vitest";

import {
  database,
  seedReviewer,
  seedUser,
  useCollectionDatabase,
} from "./support/database.ts";
import { newId, now } from "./support/fixtures.ts";
import {
  decide,
  reviewerDecides,
  rowOf,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

// Nobody reviews their own collection: refused by the repository, and independently by the review
// record itself, so no path (a later role grant, a bug, a stray query) can record it.
const decisions = [
  "start-review",
  "approve",
  "request-changes",
  "reject",
  "suspend",
  "reinstate",
  "revoke",
] as const;

async function grantReviewer(userId: string) {
  await database
    .insert(platformRoleAssignments)
    .values({ id: newId(), role: "reviewer", status: "active", userId });
}

const eventBy = (
  actorUserId: string,
  submissionId: string,
  action: "approve" | "submit",
) => ({
  action,
  actorUserId,
  correlationId: newId(),
  createdAt: now,
  id: newId(),
  idempotencyKey: `direct-${newId()}`,
  nextState:
    action === "submit" ? ("submitted" as const) : ("approved" as const),
  policyVersion: "collection-review-beta-v1",
  previousState: action === "submit" ? null : ("under-review" as const),
  reasonCode: "direct-insert",
  requestFingerprint: requestFingerprint({ direct: submissionId }),
  submissionId,
});

describe("a creator who also holds the reviewer role", () => {
  it.each(decisions)(
    "cannot %s their own collection, in any state",
    async (action) => {
      const seeded = await submitted();
      await grantReviewer(seeded.ownerUserId);
      // Whether or not the move is legal from here, the answer is the same: forbidden, nothing recorded.
      expect(
        await decide(seeded.submission.id, seeded.ownerUserId, action, {
          creatorFeedback: "Words.",
        }),
      ).toEqual({ kind: "forbidden" });
      expect((await rowOf(seeded.submission.id)).state).toBe("submitted");
    },
  );

  it("cannot approve their own collection after it has reached review, nor reinstate it", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review");
    await grantReviewer(seeded.ownerUserId);
    expect(
      await decide(seeded.submission.id, seeded.ownerUserId, "approve"),
    ).toEqual({
      kind: "forbidden",
    });
    expect((await rowOf(seeded.submission.id)).state).toBe("under-review");
  });

  it("can still decide on someone else's collection", async () => {
    const mine = await submitted();
    const theirs = await submitted();
    await grantReviewer(mine.ownerUserId);
    const result = await decide(
      theirs.submission.id,
      mine.ownerUserId,
      "start-review",
    );
    expect(result.kind).toBe("decided");
  });
});

describe("the review record refuses the wrong person by itself", () => {
  it("refuses a decision event by the creator, written directly", async () => {
    const seeded = await submitted();
    await expect(
      database
        .insert(collectionReviewEvents)
        .values(eventBy(seeded.ownerUserId, seeded.submission.id, "approve")),
    ).rejects.toMatchObject({
      cause: {
        code: "23000",
        message: expect.stringContaining("their own collection"),
      },
    });
  });

  it("refuses a submit event by anyone but the creator, written directly", async () => {
    const seeded = await submitted();
    const stranger = await seedUser();
    await expect(
      database
        .insert(collectionReviewEvents)
        .values(eventBy(stranger, seeded.submission.id, "submit")),
    ).rejects.toMatchObject({
      cause: {
        code: "23000",
        message: expect.stringContaining("only the creator submits"),
      },
    });
  });

  it("accepts a decision by someone else, written directly", async () => {
    const seeded = await submitted();
    const reviewer = await seedReviewer();
    await expect(
      database
        .insert(collectionReviewEvents)
        .values(eventBy(reviewer, seeded.submission.id, "approve")),
    ).resolves.toBeDefined();
  });
});
