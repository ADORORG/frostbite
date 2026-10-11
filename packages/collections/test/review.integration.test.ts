import { platformRoleAssignments } from "@ador/database";
import { describe, expect, it } from "vitest";

import {
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
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

const stateOf = async (id: Parameters<typeof rowOf>[0]) =>
  (await rowOf(id)).state;

describe("deciding on a submission", () => {
  it("moves a submission through review to approval and records who did what", async () => {
    const seeded = await submitted();
    const reviewer = await seedReviewer();
    const id = seeded.submission.id;
    const started = await decide(id, reviewer, "start-review");
    const approved = await decide(id, reviewer, "approve", {
      privateNotes: "Checked the provenance.",
      reasonCode: "meets-policy",
    });
    if (started.kind !== "decided" || approved.kind !== "decided")
      throw new Error(`got ${started.kind} then ${approved.kind}`);
    expect(approved.submission.state).toBe("approved");
    expect(
      approved.submission.events.map((event) => [
        event.action,
        event.previousState,
        event.nextState,
        event.actorUserId === reviewer,
      ]),
    ).toEqual([
      ["submit", null, "submitted", false],
      ["start-review", "submitted", "under-review", true],
      ["approve", "under-review", "approved", true],
    ]);
    expect(approved.submission.events.at(-1)).toMatchObject({
      privateNotes: "Checked the provenance.",
      reasonCode: "meets-policy",
    });
  });

  it("walks every legal path: changes requested, rejection, suspension, reinstatement, revocation", async () => {
    const changes = await submitted();
    await reviewerDecides(changes.submission.id, "start-review");
    await reviewerDecides(changes.submission.id, "request-changes", {
      creatorFeedback: "More detail.",
    });
    expect(await stateOf(changes.submission.id)).toBe("changes-requested");

    const rejected = await submitted();
    await reviewerDecides(rejected.submission.id, "start-review");
    await reviewerDecides(rejected.submission.id, "reject", {
      creatorFeedback: "Not suitable.",
    });
    expect(await stateOf(rejected.submission.id)).toBe("rejected");

    const live = await submitted();
    for (const action of ["start-review", "approve"] as const)
      await reviewerDecides(live.submission.id, action);
    await reviewerDecides(live.submission.id, "suspend", {
      creatorFeedback: "Under investigation.",
    });
    expect(await stateOf(live.submission.id)).toBe("suspended");
    await reviewerDecides(live.submission.id, "reinstate");
    expect(await stateOf(live.submission.id)).toBe("approved");
    await reviewerDecides(live.submission.id, "revoke", {
      creatorFeedback: "Rights dispute.",
    });
    expect(await stateOf(live.submission.id)).toBe("revoked");
  });

  it.each(["approve", "reject", "suspend", "reinstate"] as const)(
    "refuses %s before review has started and changes nothing",
    async (action) => {
      const seeded = await submitted();
      const before = await rowOf(seeded.submission.id);
      expect(
        await reviewerDecides(seeded.submission.id, action, {
          creatorFeedback: "Words.",
        }),
      ).toEqual({ kind: "invalid-transition", state: "submitted" });
      expect(await rowOf(seeded.submission.id)).toEqual(before);
    },
  );

  it("refuses to start a review that has already started", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review");
    expect(await reviewerDecides(seeded.submission.id, "start-review")).toEqual(
      { kind: "invalid-transition", state: "under-review" },
    );
  });

  it("never reopens a finished submission", async () => {
    const seeded = await submitted();
    await reviewerDecides(seeded.submission.id, "start-review");
    await reviewerDecides(seeded.submission.id, "reject", {
      creatorFeedback: "No.",
    });
    for (const action of [
      "start-review",
      "approve",
      "request-changes",
      "reinstate",
      "revoke",
    ] as const)
      expect(
        await reviewerDecides(seeded.submission.id, action, {
          creatorFeedback: "Words.",
        }),
      ).toEqual({
        kind: "invalid-transition",
        state: "rejected",
      });
  });
});

describe("who may decide", () => {
  it("refuses someone who holds no reviewer role, a suspended reviewer, and a different role", async () => {
    const seeded = await submitted();
    const id = seeded.submission.id;
    for (const actor of [
      (await readyCollection()).ownerUserId,
      await seedReviewer("reviewer", "suspended"),
      await seedReviewer("staff"),
    ])
      expect(await decide(id, actor, "start-review")).toEqual({
        kind: "forbidden",
      });
    expect(await stateOf(id)).toBe("submitted");
  });

  it("refuses a reviewer who is also the creator, whatever the role", async () => {
    const seeded = await submitted();
    const owner = seeded.ownerUserId;
    await database.insert(platformRoleAssignments).values({
      id: newId(),
      role: "reviewer",
      status: "active",
      userId: owner,
    });
    expect(await decide(seeded.submission.id, owner, "start-review")).toEqual({
      kind: "forbidden",
    });
    expect(await stateOf(seeded.submission.id)).toBe("submitted");
  });

  it("refuses everyone when no role is allowed to review", async () => {
    const seeded = await submitted();
    expect(
      await reviewerDecides(seeded.submission.id, "start-review", {
        allowedReviewerRoles: [],
      }),
    ).toEqual({ kind: "forbidden" });
  });

  it("answers an unknown submission as not found", async () => {
    expect(await reviewerDecides(newId(), "start-review")).toEqual({
      kind: "not-found",
    });
  });

  it("will not approve or reinstate for a creator who is no longer approved, but still lets a rejection or revocation through", async () => {
    const seeded = await submitted();
    const id = seeded.submission.id;
    await reviewerDecides(id, "start-review");
    await setApplicationState(seeded.ownerUserId, "suspended");
    expect(await reviewerDecides(id, "approve")).toEqual({
      kind: "owner-not-eligible",
    });
    expect(await stateOf(id)).toBe("under-review");
    expect(
      (
        await reviewerDecides(id, "reject", {
          creatorFeedback: "Suspended creator.",
        })
      ).kind,
    ).toBe("decided");

    const live = await submitted();
    await reviewerDecides(live.submission.id, "start-review");
    await reviewerDecides(live.submission.id, "approve");
    await reviewerDecides(live.submission.id, "suspend", {
      creatorFeedback: "Investigating.",
    });
    await setApplicationState(live.ownerUserId, "revoked");
    expect(await reviewerDecides(live.submission.id, "reinstate")).toEqual({
      kind: "owner-not-eligible",
    });
    expect(
      (
        await reviewerDecides(live.submission.id, "revoke", {
          creatorFeedback: "Creator revoked.",
        })
      ).kind,
    ).toBe("decided");
  });
});
