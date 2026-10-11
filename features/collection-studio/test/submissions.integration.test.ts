import {
  collectionDetailSchema,
  collectionItemChangeSchema,
  collectionRoutes,
  collectionSubmissionListSchema,
  collectionSubmissionResponseSchema,
  submissionRoutes,
} from "@ador/shared/collections";
import { seedCreatorUser } from "@ador/test-kit/creator-database";
import { beforeAll, describe, expect, it } from "vitest";

import {
  call,
  creatorWithImages,
  database,
  draft,
  errorOf,
  item,
  key,
  migrate,
} from "./support/studio-harness.ts";

beforeAll(migrate);

// A creator with a collection that is ready to submit, returning the revision the creator last saw.
async function readyCreator(overrides: object = {}) {
  const seed = await creatorWithImages();
  const created = await call(collectionRoutes.create, {
    actor: seed.userId,
    body: draft({
      coverAssetId: seed.cover,
      description: "About",
      plannedSupply: 1,
      ...overrides,
    }),
    key: key(),
  });
  const collectionId = collectionDetailSchema.parse(created.body).collection.id;
  const added = await call(collectionRoutes.addItem, {
    actor: seed.userId,
    body: { collectionId, item: item(seed.image) },
    key: key(),
  });
  const { revision } = collectionItemChangeSchema.parse(added.body);
  return { ...seed, collectionId, revision };
}

const submitBody = (ready: { collectionId: string; revision: number }) => ({
  collectionId: ready.collectionId,
  expectedRevision: ready.revision,
});

describe("submitting a collection over the real database", () => {
  it("freezes a ready collection and lets the creator follow it", async () => {
    const ready = await readyCreator();
    const submitted = await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: submitBody(ready),
      key: key(),
    });
    expect(submitted.status).toBe(200);
    const { submission } = collectionSubmissionResponseSchema.parse(
      submitted.body,
    );
    expect(submission).toMatchObject({
      collectionId: ready.collectionId,
      collectionRevision: ready.revision,
      decisions: [],
      sequence: 1,
      state: "submitted",
    });
    const listed = await call(submissionRoutes.list, {
      actor: ready.userId,
      body: { collectionId: ready.collectionId },
    });
    expect(
      collectionSubmissionListSchema
        .parse(listed.body)
        .submissions.map(({ id }) => id),
    ).toEqual([submission.id]);
  });

  it("answers a retry with the same key and request with the same submission", async () => {
    const ready = await readyCreator();
    const retryKey = key();
    const first = await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: submitBody(ready),
      key: retryKey,
    });
    const second = await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: submitBody(ready),
      key: retryKey,
    });
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it("requires a session and an idempotency key", async () => {
    const ready = await readyCreator();
    const anonymous = await call(submissionRoutes.submit, {
      actor: null,
      body: submitBody(ready),
      key: key(),
    });
    expect([anonymous.status, errorOf(anonymous.body)]).toEqual([
      401,
      "unauthorized",
    ]);
    const unkeyed = await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: submitBody(ready),
    });
    expect(unkeyed.status).toBe(400);
    expect(
      (
        await call(submissionRoutes.list, {
          actor: null,
          body: { collectionId: ready.collectionId },
        })
      ).status,
    ).toBe(401);
  });

  it("refuses a collection that is not ready, naming what is missing", async () => {
    const ready = await readyCreator({ description: "" });
    const refused = await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: submitBody(ready),
      key: key(),
    });
    expect([refused.status, errorOf(refused.body)]).toEqual([
      400,
      "invalid_request",
    ]);
    expect(JSON.stringify(refused.body)).toContain("a description");
  });

  it("refuses a stale revision, a second submission, and another creator's collection", async () => {
    const ready = await readyCreator();
    const stale = await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: { ...submitBody(ready), expectedRevision: ready.revision - 1 },
      key: key(),
    });
    expect([stale.status, errorOf(stale.body)]).toEqual([409, "conflict"]);
    await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: submitBody(ready),
      key: key(),
    });
    const again = await call(submissionRoutes.submit, {
      actor: ready.userId,
      body: submitBody(ready),
      key: key(),
    });
    expect([again.status, errorOf(again.body)]).toEqual([409, "conflict"]);
    const stranger = await seedCreatorUser(database);
    const foreign = await call(submissionRoutes.submit, {
      actor: stranger,
      body: submitBody(ready),
      key: key(),
    });
    expect([foreign.status, errorOf(foreign.body)]).toEqual([404, "not_found"]);
    const foreignList = await call(submissionRoutes.list, {
      actor: stranger,
      body: { collectionId: ready.collectionId },
    });
    expect(
      collectionSubmissionListSchema.parse(foreignList.body).submissions,
    ).toEqual([]);
  });
});
