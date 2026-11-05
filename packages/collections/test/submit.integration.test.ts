import {
  assets,
  collectionReviewEvents,
  collectionSubmissions,
} from "@frostbite/database";
import { requestFingerprint } from "@frostbite/shared/http";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  repository,
  seedAsset,
  seedUser,
  setApplicationState,
  useCollectionDatabase,
} from "./support/database.ts";
import { draft, mutation, newId } from "./support/fixtures.ts";
import {
  readyCollection,
  rowOf,
  submit,
  submitContext,
  submitted,
} from "./support/submissions.ts";

useCollectionDatabase();

const eventsOf = (submissionId: string) =>
  database
    .select()
    .from(collectionReviewEvents)
    .where(eq(collectionReviewEvents.submissionId, submissionId));

describe("submitting a collection", () => {
  it("freezes the draft, its items in order, and each image's content hash, and records the submit event", async () => {
    const ready = await readyCollection();
    const result = await submit(ready);
    if (result.kind !== "submitted") throw new Error(`got ${result.kind}`);
    const row = await rowOf(result.submission.id);
    expect(row).toMatchObject({
      collectionId: ready.collectionId,
      collectionRevision: ready.revision,
      ownerUserId: ready.ownerUserId,
      sequence: 1,
      state: "submitted",
    });
    expect(row.snapshot.collection).toEqual(
      draft({ coverAssetId: ready.cover, plannedSupply: 2 }),
    );
    expect(
      row.snapshot.items.map(({ name, position }) => [position, name]),
    ).toEqual([
      [1, "Item 1"],
      [2, "Item 2"],
    ]);
    const stored = await database
      .select({ sha: assets.contentSha256, id: assets.id })
      .from(assets);
    expect(row.snapshot.assets).toHaveLength(3);
    for (const asset of row.snapshot.assets)
      expect(asset.contentSha256).toBe(
        stored.find(({ id }) => id === asset.id)?.sha,
      );
    expect(row.payloadHash).toBe(requestFingerprint(row.snapshot));
    expect(await eventsOf(row.id)).toMatchObject([
      {
        action: "submit",
        actorUserId: ready.ownerUserId,
        nextState: "submitted",
        previousState: null,
      },
    ]);
    expect(result.submission.decisions).toEqual([]);
  });

  it("keeps the reviewed snapshot unchanged when the draft is edited afterwards", async () => {
    const ready = await readyCollection();
    const { submission } = await submitted(ready);
    const before = await rowOf(submission.id);
    const saved = await repository.save({
      changedAt: new Date(),
      collectionId: ready.collectionId,
      draft: draft({
        coverAssetId: ready.cover,
        name: "Renamed after submission",
        plannedSupply: 2,
      }),
      expectedRevision: ready.revision,
      ownerUserId: ready.ownerUserId,
    });
    expect(saved.kind).toBe("saved");
    const after = await rowOf(submission.id);
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.snapshot.collection.name).toBe("First light");
    expect(after.payloadHash).toBe(before.payloadHash);
  });

  it("produces the same hash for the same content, however the rows are read", async () => {
    const first = await submitted(await readyCollection());
    const second = await submitted(await readyCollection());
    // Different collections differ (ids, assets); the hash is of the snapshot, so it is stable per row.
    expect(first.submission.payloadHash).not.toBe(
      second.submission.payloadHash,
    );
    const row = await rowOf(first.submission.id);
    expect(requestFingerprint(row.snapshot)).toBe(first.submission.payloadHash);
  });

  it("refuses a draft that changed since the creator last saw it", async () => {
    const ready = await readyCollection();
    expect(
      await submit(ready, { expectedRevision: ready.revision - 1 }),
    ).toEqual({
      currentRevision: ready.revision,
      kind: "revision-conflict",
    });
    expect(await database.select().from(collectionSubmissions)).toHaveLength(0);
  });

  it.each([
    ["no description", { description: "" }, ["description"]],
    ["no cover image", { coverAssetId: null }, ["cover-image"]],
  ] as const)(
    "reports what is missing when there is %s",
    async (_name, changes, missing) => {
      const ready = await readyCollection();
      const result = await repository.save({
        changedAt: new Date(),
        collectionId: ready.collectionId,
        draft: draft({
          coverAssetId: ready.cover,
          plannedSupply: 2,
          ...changes,
        }),
        expectedRevision: ready.revision,
        ownerUserId: ready.ownerUserId,
      });
      if (result.kind !== "saved") throw new Error(`got ${result.kind}`);
      expect(
        await submit(ready, {
          expectedRevision: result.aggregate.collection.revision,
        }),
      ).toEqual({ kind: "not-ready", missing });
    },
  );

  it("reports missing items when fewer than the planned supply exist", async () => {
    const owner = await seedUser();
    const cover = await seedAsset(owner, "collection-artwork");
    const created = await repository.create({
      ...mutation(owner),
      collectionId: newId(),
      draft: draft({ coverAssetId: cover, plannedSupply: 3 }),
    });
    if (created.kind !== "created") throw new Error(`got ${created.kind}`);
    const result = await submit({
      collectionId: created.aggregate.collection.id,
      cover,
      ownerUserId: owner,
      revision: 1,
    });
    expect(result).toEqual({ kind: "not-ready", missing: ["all-items"] });
  });

  it("refuses an image that is no longer the creator's processed upload", async () => {
    const ready = await readyCollection();
    const stranger = await seedUser();
    await database
      .update(assets)
      .set({ userId: stranger })
      .where(eq(assets.id, ready.cover));
    expect(await submit(ready)).toEqual({
      assetId: ready.cover,
      kind: "invalid-asset",
    });
  });

  it("refuses a collection whose chain is no longer offered", async () => {
    expect(
      await submit(await readyCollection(), { allowedChains: [] }),
    ).toEqual({
      kind: "invalid-chain",
    });
  });

  it("refuses a creator who is no longer approved, and another creator's collection", async () => {
    const ready = await readyCollection();
    const other = await seedUser();
    expect(await submit(ready, submitContext(other))).toEqual({
      kind: "not-found",
    });
    await setApplicationState(ready.ownerUserId, "suspended");
    expect(await submit(ready)).toEqual({ kind: "not-eligible" });
    expect(await database.select().from(collectionSubmissions)).toHaveLength(0);
  });

  it("refuses an unknown collection", async () => {
    const ready = await readyCollection();
    expect(await submit({ ...ready, collectionId: newId() })).toEqual({
      kind: "not-found",
    });
  });
});
