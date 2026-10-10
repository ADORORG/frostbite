import {
  encodeActivityCursor,
  reviewActivityResponseSchema,
  reviewDetailResponseSchema,
  reviewRoutes,
} from "@ador/shared/collections";
import { platformRoleAssignments } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import {} from "@ador/test-kit/creator-database";
import { beforeAll, describe, expect, it } from "vitest";

import {
  call,
  database,
  errorOf,
  key,
  migrate,
  reviewer,
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

describe("the activity log and access rules over the real database", () => {
  it("shows the activity log newest first, with who acted, pages cut at a cursor, and no private notes", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "start-review", {
        privateNotes: "log-secret-note",
      }),
      key: key(),
    });
    const first = await call(reviewRoutes.activity, {
      actor,
      body: { cursor: null },
    });
    expect(first.status).toBe(200);
    const page = reviewActivityResponseSchema.parse(first.body);
    const ours = page.items.filter(
      ({ submissionId }) => submissionId === seed.submissionId,
    );
    expect(ours.map(({ action }) => action)).toEqual([
      "start-review",
      "submit",
    ]);
    expect(ours[0]).toMatchObject({
      actorUserId: actor,
      collectionName: "First light",
      nextState: "under-review",
    });
    expect(JSON.stringify(first.body)).not.toContain("log-secret-note");
    const [newest] = page.items;
    if (newest === undefined) throw new Error("empty log");
    // A page cut after the newest event never repeats it.
    const older = await call(reviewRoutes.activity, {
      actor,
      body: {
        cursor: encodeActivityCursor({
          createdAt: newest.createdAt,
          id: newest.eventId,
        }),
      },
    });
    const olderIds = reviewActivityResponseSchema
      .parse(older.body)
      .items.map(({ eventId }) => eventId);
    expect(olderIds).not.toContain(newest.eventId);
    expect(olderIds).toContain(ours[1]?.eventId);
  });

  it("refuses a cursor the log did not produce, and a request without a session", async () => {
    const actor = await reviewer();
    const bad = await call(reviewRoutes.activity, {
      actor,
      body: {
        cursor: encodeActivityCursor({ createdAt: "not-a-time", id: "x" }),
      },
    });
    expect([bad.status, errorOf(bad.body)]).toEqual([400, "invalid_request"]);
    // Well-formed text that is not a position of the log is refused by the operation itself.
    const forged = await call(reviewRoutes.activity, {
      actor,
      body: { cursor: "A".repeat(30) },
    });
    expect([forged.status, errorOf(forged.body)]).toEqual([
      400,
      "invalid_request",
    ]);
    expect(JSON.stringify(forged.body)).toContain(
      "The page cursor is not valid.",
    );
    const anonymous = await call(reviewRoutes.activity, {
      actor: null,
      body: { cursor: null },
    });
    expect(anonymous.status).toBe(401);
  });

  it("names who acted on each event and shows the creator's standing when a submission is read", async () => {
    const seed = await submittedCollection();
    const actor = await reviewer();
    await call(reviewRoutes.decide, {
      actor,
      body: decision(seed.submissionId, "start-review"),
      key: key(),
    });
    const read = await call(reviewRoutes.read, {
      actor,
      body: { submissionId: seed.submissionId },
    });
    const { submission } = reviewDetailResponseSchema.parse(read.body);
    expect(submission.ownerState).toBe("approved");
    expect(
      submission.events
        .map(({ actorName }) => actorName)
        .every((name) => name !== ""),
    ).toBe(true);
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
});
