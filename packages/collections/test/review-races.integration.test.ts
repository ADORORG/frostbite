import {
  collectionReviewEvents,
  creatorApplications,
  platformRoleAssignments,
  type CreatorApplication,
} from "@frostbite/database";
import { expectToWait, holdTransaction } from "@frostbite/test-kit/race";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { isApprovedCreator } from "../src/adapters/guards.ts";
import {
  approvedVersions,
  database,
  seedReviewer,
  setApplicationState,
  useCollectionDatabase,
} from "./support/database.ts";
import {
  decide,
  reviewerDecides,
  rowOf,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

// An approval must not slip past a change in flight to who may approve or who may be approved: the
// decision waits for it, then sees it. Each case holds the other change open, starts the decision,
// proves the decision is blocked, lets the change commit, and checks what the decision then did.
// The creator's application moved to `state` inside a transaction that stays open (the change in flight).
const changing = (userId: string, state: CreatorApplication["state"]) =>
  holdTransaction(database, (transaction) =>
    transaction
      .update(creatorApplications)
      .set({ state })
      .where(eq(creatorApplications.applicantUserId, userId)),
  );

async function inReview() {
  const seeded = await submitted();
  await reviewerDecides(seeded.submission.id, "start-review");
  return seeded;
}

describe("an approval racing the creator's suspension or revocation", () => {
  it.each(["suspended", "revoked"] as const)(
    "waits for a creator being %s, then refuses to approve",
    async (state) => {
      const seeded = await inReview();
      const holder = await changing(seeded.ownerUserId, state);
      const result = await expectToWait(holder, () =>
        reviewerDecides(seeded.submission.id, "approve"),
      );
      expect(result).toEqual({ kind: "owner-not-eligible" });
      expect((await rowOf(seeded.submission.id)).state).toBe("under-review");
      expect(
        await approvedVersions.findApprovedVersion(seeded.collectionId),
      ).toBeNull();
    },
  );

  it("does not wait for a creator being suspended when the decision is a rejection, which needs no approved creator", async () => {
    const seeded = await inReview();
    const holder = await changing(seeded.ownerUserId, "suspended");
    const result = await reviewerDecides(seeded.submission.id, "reject", {
      creatorFeedback: "Creator suspended.",
    });
    expect(result.kind).toBe("decided");
    holder.release();
    await holder.finished;
  });

  it("makes a revocation of the creator wait for the approval check in flight, and ends with no approved version", async () => {
    const seeded = await inReview();
    // The decision's check of the creator, held open: it shares the creator's application row.
    const approval = await holdTransaction(database, async (transaction) => {
      expect(await isApprovedCreator(transaction, seeded.ownerUserId)).toBe(
        true,
      );
    });
    await expectToWait(approval, () =>
      setApplicationState(seeded.ownerUserId, "revoked"),
    );
    expect(
      await approvedVersions.findApprovedVersion(seeded.collectionId),
    ).toBeNull();
  });
});

describe("a decision racing the withdrawal of the reviewer's role", () => {
  it("waits for the withdrawal, then refuses", async () => {
    const seeded = await inReview();
    const reviewer = await seedReviewer();
    const holder = await holdTransaction(database, (transaction) =>
      transaction
        .update(platformRoleAssignments)
        .set({ status: "suspended" })
        .where(eq(platformRoleAssignments.userId, reviewer)),
    );
    const result = await expectToWait(holder, () =>
      decide(seeded.submission.id, reviewer, "approve"),
    );
    expect(result).toEqual({ kind: "forbidden" });
    expect((await rowOf(seeded.submission.id)).state).toBe("under-review");
  });
});

describe("concurrent decisions, suspensions, and revocations", () => {
  it("never deadlock, and leave the record consistent with the state", async () => {
    for (let round = 0; round < 12; round += 1) {
      const seeded = await inReview();
      const [first, second] = [await seedReviewer(), await seedReviewer()];
      const outcomes = await Promise.allSettled([
        decide(seeded.submission.id, first, "approve"),
        setApplicationState(
          seeded.ownerUserId,
          round % 2 === 0 ? "suspended" : "revoked",
        ),
        decide(seeded.submission.id, second, "reject", {
          creatorFeedback: "No.",
        }),
        setApplicationState(seeded.ownerUserId, "approved"),
      ]);
      // A deadlock or any other failure surfaces as a rejected promise.
      expect(outcomes.filter(({ status }) => status === "rejected")).toEqual(
        [],
      );
      const { state } = await rowOf(seeded.submission.id);
      expect(["approved", "rejected"]).toContain(state);
      const events = await database
        .select()
        .from(collectionReviewEvents)
        .where(eq(collectionReviewEvents.submissionId, seeded.submission.id));
      // Exactly one decision ended the review, and it is the one the state shows.
      expect(
        events.filter(({ nextState }) => nextState === state),
      ).toHaveLength(1);
    }
  });
});
