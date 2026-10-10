import {
  reviewDetailResponseSchema,
  reviewQueueResponseSchema,
  reviewRoutes,
  reviewSubmissionResponseSchema,
} from "@ador/shared/collections";
import { platformRoleAssignments } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import {
  seedCreatorUser,
  setCreatorApplicationState,
} from "@ador/test-kit/creator-database";
import { beforeAll, describe, expect, it } from "vitest";

import {
  call,
  database,
  errorOf,
  key,
  migrate,
  reviewer,
  signedUrl,
  submittedCollection,
} from "./support/review-harness.ts";

beforeAll(migrate);

const decision = (
  submissionId: string,
  action: string,
  extra: object = {},
) => ({
  action,
  creatorFeedback: "",
  privateNotes: "",
  reasonCode: "reviewed-by-staff",
  submissionId,
  ...extra,
});

describe("reviewing submissions over the real database", () => {
  it("lets a reviewer find a submission, read it in full, and take it through to approval", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    const queue = await call(reviewRoutes.queue, {
      actor,
      body: { states: ["submitted"] },
    });
    expect(
      reviewQueueResponseSchema
        .parse(queue.body)
        .items.some(({ id }) => id === seed.submissionId),
    ).toBe(true);

    const read = await call(reviewRoutes.read, {
      actor,
      body: { submissionId: seed.submissionId },
    });
    const { previews, submission } = reviewDetailResponseSchema.parse(
      read.body,
    );
    expect(submission).toMatchObject({
      collectionId: seed.collectionId,
      ownerUserId: seed.ownerUserId,
      state: "submitted",
    });
    expect(submission.snapshot.items).toHaveLength(1);
    // The reviewer sees the art: the cover's short-lived signed rendition, for this submission's own images.
    const cover = previews.find(({ id }) => id === seed.cover);
    expect(cover?.derivatives[0]?.url).toBe(signedUrl(seed.coverKey));
    expect(previews.map(({ id }) => id).sort()).toEqual(
      submission.snapshot.assets.map(({ id }) => id).sort(),
    );

    for (const action of ["start-review", "approve"] as const) {
      const decided = await call(reviewRoutes.decide, {
        actor,
        body: decision(seed.submissionId, action, {
          privateNotes: "Checked.",
        }),
        key: key(),
      });
      expect(decided.status).toBe(200);
      // A decision answers with the submission as it now stands (no previews: the page keeps its own).
      expect(
        reviewSubmissionResponseSchema.parse(decided.body).submission.id,
      ).toBe(seed.submissionId);
    }
    const after = await call(reviewRoutes.read, {
      actor,
      body: { submissionId: seed.submissionId },
    });
    const view = reviewDetailResponseSchema.parse(after.body).submission;
    expect(view.state).toBe("approved");
    expect(view.events.map(({ action }) => action)).toEqual([
      "submit",
      "start-review",
      "approve",
    ]);
    expect(view.events.at(-1)).toMatchObject({
      actorUserId: actor,
      privateNotes: "Checked.",
    });
  });

  it("answers a retried decision with the recorded one", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    const retryKey = key();
    const body = decision(seed.submissionId, "start-review");
    const first = await call(reviewRoutes.decide, {
      actor,
      body,
      key: retryKey,
    });
    const second = await call(reviewRoutes.decide, {
      actor,
      body,
      key: retryKey,
    });
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(second.body).toEqual(first.body);
  });

  it("refuses the same key used for a different decision", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    const reused = key();
    await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "start-review"),
      key: reused,
    });
    const other = await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "approve"),
      key: reused,
    });
    expect([other.status, errorOf(other.body)]).toEqual([409, "conflict"]);
  });

  it("will not approve for a creator who is no longer approved", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "start-review"),
      key: key(),
    });
    await setCreatorApplicationState(database, seed.ownerUserId, "suspended");
    const refused = await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "approve"),
      key: key(),
    });
    expect([refused.status, errorOf(refused.body)]).toEqual([409, "conflict"]);
    expect(JSON.stringify(refused.body)).toContain(
      "no longer an approved creator",
    );
  });

  it("requires a session, a key, and feedback where the creator must be told why", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    const anonymous = await call(reviewRoutes.decide, {
      actor: null,
      body: decision(seed.submissionId, "start-review"),
      key: key(),
    });
    expect([anonymous.status, errorOf(anonymous.body)]).toEqual([
      401,
      "unauthorized",
    ]);
    expect(
      (
        await call(reviewRoutes.decide, {
          actor,
          body: decision(seed.submissionId, "start-review"),
        })
      ).status,
    ).toBe(400);
    const bare = await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "reject"),
      key: key(),
    });
    expect([bare.status, errorOf(bare.body)]).toEqual([400, "invalid_request"]);
    const queue = await call(reviewRoutes.queue, {
      actor: null,
      body: { states: ["submitted"] },
    });
    const read = await call(reviewRoutes.read, {
      actor: null,
      body: { submissionId: seed.submissionId },
    });
    expect([queue.status, read.status]).toEqual([401, 401]);
  });

  it("refuses a decision by someone without a reviewer role, and by the creator", async () => {
    const seed = await submittedCollection();
    const outsider = await seedCreatorUser(database);
    const refused = await call(reviewRoutes.decide, {
      actor: outsider,
      body: decision(seed.submissionId, "start-review"),
      key: key(),
    });
    expect([refused.status, errorOf(refused.body)]).toEqual([403, "forbidden"]);
    const own = await call(reviewRoutes.decide, {
      actor: seed.ownerUserId,
      body: decision(seed.submissionId, "start-review"),
      key: key(),
    });
    expect([own.status, errorOf(own.body)]).toEqual([403, "forbidden"]);
  });

  it("refuses a creator who has also been given the reviewer role, for every decision", async () => {
    const seed = await submittedCollection();
    await database.insert(platformRoleAssignments).values({
      id: createUuidV7(),
      role: "reviewer",
      status: "active",
      userId: seed.ownerUserId,
    });
    for (const action of ["start-review", "approve"]) {
      const refused = await call(reviewRoutes.decide, {
        actor: seed.ownerUserId,
        body: decision(seed.submissionId, action),
        key: key(),
      });
      expect([refused.status, errorOf(refused.body)]).toEqual([
        403,
        "forbidden",
      ]);
    }
  });

  it("reports an illegal move as a conflict, and an unknown submission as not found", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    const early = await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "approve"),
      key: key(),
    });
    expect([early.status, errorOf(early.body)]).toEqual([409, "conflict"]);
    expect(JSON.stringify(early.body)).toContain("submitted");
    const unknown = "018f22f2-9c1a-7b21-8c45-0000000000ff";
    const missing = await call(reviewRoutes.decide, {
      actor,
      body: decision(unknown, "start-review"),
      key: key(),
    });
    expect([missing.status, errorOf(missing.body)]).toEqual([404, "not_found"]);
    const unread = await call(reviewRoutes.read, {
      actor,
      body: { submissionId: unknown },
    });
    expect([unread.status, errorOf(unread.body)]).toEqual([404, "not_found"]);
  });
});
