import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  attemptsOf,
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
      attempts: 0,
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

  it("puts a failed removal off until its retry time, counts the attempt, and then returns it again", async () => {
    const userId = await createUser();
    const poison = await seedIntent(userId, { cleanupDueInMs: -9_000 });
    const other = await seedIntent(userId, { cleanupDueInMs: -1_000 });
    await claim();
    const retryAt = new Date(now.getTime() + 60_000);
    await cleanupRepository.recordFailure({ intentId: poison.id, retryAt });
    // Though it is the oldest, it waits; the rest are not crowded out.
    await expect(claim(1)).resolves.toMatchObject([{ intentId: other.id }]);
    await expect(
      cleanupRepository.claim({
        limit: 10,
        now: new Date(retryAt.getTime() - 1),
        storageProviderId: providerId,
      }),
    ).resolves.toMatchObject([{ intentId: other.id }]);
    const later = await cleanupRepository.claim({
      limit: 10,
      now: retryAt,
      storageProviderId: providerId,
    });
    expect(later.find(({ intentId }) => intentId === poison.id)).toMatchObject({
      attempts: 1,
    });
    await cleanupRepository.recordFailure({
      intentId: poison.id,
      retryAt: new Date(retryAt.getTime() + 60_000),
    });
    const again = await cleanupRepository.claim({
      limit: 10,
      now: new Date(retryAt.getTime() + 60_000),
      storageProviderId: providerId,
    });
    expect(again.find(({ intentId }) => intentId === poison.id)).toMatchObject({
      attempts: 2,
    });
  });

  it("does not record a failure against an intent whose object is already gone or that is not abandoned", async () => {
    const userId = await createUser();
    const gone = await seedIntent(userId);
    await claim();
    await cleanupRepository.markObjectRemoved({
      intentId: gone.id,
      removedAt: now,
    });
    const reserved = await seedIntent(userId, { cleanupDueInMs: 1_000 });
    for (const id of [gone.id, reserved.id])
      await cleanupRepository.recordFailure({
        intentId: id,
        retryAt: new Date(now.getTime() + 60_000),
      });
    await expect(claim()).resolves.toEqual([]);
    expect(await attemptsOf(gone.id)).toBe(0);
    expect(await attemptsOf(reserved.id)).toBe(0);
    await expect(
      cleanupRepository.claim({
        limit: 10,
        now: new Date(now.getTime() + 2_000),
        storageProviderId: providerId,
      }),
    ).resolves.toMatchObject([{ attempts: 0, intentId: reserved.id }]);
  });
});
