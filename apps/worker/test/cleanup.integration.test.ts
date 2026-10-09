import {
  parseDatabaseEnvironment,
  runMigrations,
  uploadIntents,
} from "@ador/database";
import { defaultUploadPolicy } from "@ador/shared/uploads";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { clearDatabase, database } from "./support/database.ts";
import { createScenario } from "./support/scenario.ts";
import {
  seedAbandonedUpload,
  seedCompletedUpload,
  validPng,
} from "./support/seeds.ts";

beforeAll(async () => runMigrations(parseDatabaseEnvironment(process.env)));
beforeEach(clearDatabase);
afterAll(async () => clearDatabase());

const intent = async (id: string) =>
  (
    await database.select().from(uploadIntents).where(eq(uploadIntents.id, id))
  )[0];
const removed = (id: string) => async () =>
  (await intent(id))?.objectRemovedAt === null ? undefined : true;

describe("abandoned upload cleanup through the real worker and database", () => {
  it("removes an abandoned upload's object and records it, and leaves every other upload alone", async () => {
    const scenario = await createScenario();
    try {
      const bytes = validPng();
      const abandoned = await seedAbandonedUpload({
        bytes,
        storage: scenario.storage,
      });
      const neverStarted = await seedAbandonedUpload({
        storage: scenario.storage,
      });
      const completed = await seedCompletedUpload({ bytes });
      scenario.storage.objects.set(completed.objectKey, bytes);
      const results = await scenario.runCleanupUntil(
        removed(neverStarted.intentId),
      );
      expect(await intent(abandoned.intentId)).toMatchObject({
        objectRemovedAt: expect.any(Date),
        state: "abandoned",
      });
      expect(scenario.storage.objects.has(abandoned.objectKey)).toBe(false);
      expect(scenario.storage.deletions.sort()).toEqual(
        [abandoned.objectKey, neverStarted.objectKey].sort(),
      );
      // The completed upload and its object are untouched.
      expect(await intent(completed.intentId)).toMatchObject({
        objectRemovedAt: null,
        state: "completed",
      });
      expect(scenario.storage.objects.has(completed.objectKey)).toBe(true);
      expect(results[0]).toMatchObject({ failures: [], removed: 2 });
    } finally {
      await scenario.stop();
    }
  });

  it("drains a backlog in policy-sized batches, the next one straight away", async () => {
    const scenario = await createScenario();
    try {
      const backlog = defaultUploadPolicy.cleanupBatchSize + 1;
      const seeded = await Promise.all(
        Array.from({ length: backlog }, () =>
          seedAbandonedUpload({ storage: scenario.storage }),
        ),
      );
      const results = await scenario.runCleanupUntil(async () =>
        (await database.select().from(uploadIntents)).every(
          ({ objectRemovedAt }) => objectRemovedAt !== null,
        )
          ? true
          : undefined,
      );
      expect(results.map(({ claimed }) => claimed)).toEqual([
        defaultUploadPolicy.cleanupBatchSize,
        1,
      ]);
      expect(scenario.storage.deletions).toHaveLength(seeded.length);
    } finally {
      await scenario.stop();
    }
  });

  it("keeps an abandoned upload pending through a storage outage and removes it once storage returns", async () => {
    const scenario = await createScenario();
    try {
      const abandoned = await seedAbandonedUpload({
        bytes: validPng(),
        storage: scenario.storage,
      });
      scenario.storage.failDeletes(true);
      const outage = await scenario.runCleanupOnce();
      expect(await intent(abandoned.intentId)).toMatchObject({
        objectRemovedAt: null,
        state: "abandoned",
      });
      expect(scenario.storage.objects.has(abandoned.objectKey)).toBe(true);
      expect(outage).toHaveLength(1);
      expect(outage[0]).toMatchObject({ claimed: 1, removed: 0 });
      expect(outage[0]?.failures).toHaveLength(1);
      // A later run (after a restart, say) finds it again and finishes the job.
      scenario.storage.failDeletes(false);
      await scenario.runCleanupUntil(removed(abandoned.intentId));
      expect(scenario.storage.objects.has(abandoned.objectKey)).toBe(false);
    } finally {
      await scenario.stop();
    }
  });
});
