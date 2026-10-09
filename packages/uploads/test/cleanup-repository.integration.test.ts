import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupRepository,
  completeWithAsset,
  createUser,
  migrate,
  now,
  pool,
  providerId,
  resetTables,
  seedIntent,
  stateOf,
} from "./support/cleanup-database.ts";

beforeAll(migrate);
beforeEach(resetTables);
afterAll(async () => pool.end());

const claim = (limit = 10) =>
  cleanupRepository.claim({ limit, now, storageProviderId: providerId });

describe("abandoned upload claiming", () => {
  it("claims never-completed intents past their cleanup time and marks them abandoned", async () => {
    const userId = await createUser();
    const reserved = await seedIntent(userId);
    const failed = await seedIntent(userId, { state: "failed" });
    const claimed = await claim();
    expect(claimed.map(({ intentId }) => intentId).sort()).toEqual(
      [reserved.id, failed.id].sort(),
    );
    expect(claimed.find(({ intentId }) => intentId === reserved.id)).toEqual({
      intentId: reserved.id,
      objectKey: reserved.objectKey,
    });
    for (const { id } of [reserved, failed])
      await expect(stateOf(id)).resolves.toEqual({
        objectRemovedAt: null,
        state: "abandoned",
      });
  });

  it("leaves intents that are not yet due, completed, or backing an asset alone", async () => {
    const userId = await createUser();
    const notDue = await seedIntent(userId, { cleanupDueInMs: 1_000 });
    const completed = await completeWithAsset(userId);
    await expect(claim()).resolves.toEqual([]);
    await expect(stateOf(notDue.id)).resolves.toMatchObject({
      state: "reserved",
    });
    await expect(stateOf(completed.id)).resolves.toMatchObject({
      state: "completed",
    });
  });

  it("leaves completed and cancelled intents alone however long ago they were due", async () => {
    const userId = await createUser();
    const done = await seedIntent(userId, { state: "completed" });
    const cancelled = await seedIntent(userId, { state: "cancelled" });
    await expect(claim()).resolves.toEqual([]);
    await expect(stateOf(done.id)).resolves.toMatchObject({
      state: "completed",
    });
    await expect(stateOf(cancelled.id)).resolves.toMatchObject({
      state: "cancelled",
    });
  });

  it("never claims an intent written through another storage provider", async () => {
    const userId = await createUser();
    const foreign = await seedIntent(userId, {
      storageProvider: "previous-provider",
    });
    const foreignAbandoned = await seedIntent(userId, {
      state: "abandoned",
      storageProvider: "previous-provider",
    });
    const own = await seedIntent(userId);
    await expect(claim()).resolves.toMatchObject([{ intentId: own.id }]);
    await expect(stateOf(foreign.id)).resolves.toMatchObject({
      state: "reserved",
    });
    await expect(stateOf(foreignAbandoned.id)).resolves.toMatchObject({
      objectRemovedAt: null,
      state: "abandoned",
    });
  });

  it("treats the cleanup time itself as due", async () => {
    const userId = await createUser();
    const exact = await seedIntent(userId, { cleanupDueInMs: 0 });
    await expect(claim()).resolves.toMatchObject([{ intentId: exact.id }]);
  });

  it("claims the oldest first and no more than the limit", async () => {
    const userId = await createUser();
    const newest = await seedIntent(userId, { cleanupDueInMs: -1_000 });
    const oldest = await seedIntent(userId, { cleanupDueInMs: -3_000 });
    const middle = await seedIntent(userId, { cleanupDueInMs: -2_000 });
    const first = await claim(2);
    expect(first.map(({ intentId }) => intentId)).toEqual([
      oldest.id,
      middle.id,
    ]);
    await expect(stateOf(newest.id)).resolves.toMatchObject({
      state: "reserved",
    });
  });

  it("returns an abandoned intent again until its object removal is recorded", async () => {
    const userId = await createUser();
    const intent = await seedIntent(userId);
    await claim();
    await expect(claim()).resolves.toMatchObject([{ intentId: intent.id }]);
    const removedAt = new Date(now.getTime() + 5_000);
    await cleanupRepository.markObjectRemoved({
      intentId: intent.id,
      removedAt,
    });
    await expect(claim()).resolves.toEqual([]);
    await expect(stateOf(intent.id)).resolves.toEqual({
      objectRemovedAt: removedAt,
      state: "abandoned",
    });
  });
});
