import { idempotencyKeySchema } from "@ador/shared/http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { uploadIntents } from "@ador/database";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupRepository,
  completeWithAsset,
  createUser,
  database,
  intentRepository,
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

describe("abandoned upload cleanup safety", () => {
  it("never claims an intent that has an asset, even if its state is inconsistent", async () => {
    // Completion always marks the intent completed, so this cannot happen through the application.
    // The guard exists for the day something else breaks: an object an asset refers to must survive.
    const userId = await createUser();
    const backed = await completeWithAsset(userId);
    await database
      .update(uploadIntents)
      .set({
        cleanupEligibleAt: new Date(now.getTime() - 1_000),
        expiresAt: new Date(now.getTime() - 2_000),
        state: "reserved",
      })
      .where(eq(uploadIntents.id, backed.id));
    await expect(claim()).resolves.toEqual([]);
    await database
      .update(uploadIntents)
      .set({ state: "abandoned" })
      .where(eq(uploadIntents.id, backed.id));
    await expect(claim()).resolves.toEqual([]);
    await expect(stateOf(backed.id)).resolves.toEqual({
      objectRemovedAt: null,
      state: "abandoned",
    });
  });

  it("records removal once and only for an abandoned intent", async () => {
    const userId = await createUser();
    const live = await seedIntent(userId, { cleanupDueInMs: 1_000 });
    await cleanupRepository.markObjectRemoved({
      intentId: live.id,
      removedAt: now,
    });
    await expect(stateOf(live.id)).resolves.toEqual({
      objectRemovedAt: null,
      state: "reserved",
    });
    const due = await seedIntent(userId);
    await claim();
    const first = new Date(now.getTime() + 1_000);
    await cleanupRepository.markObjectRemoved({
      intentId: due.id,
      removedAt: first,
    });
    await cleanupRepository.markObjectRemoved({
      intentId: due.id,
      removedAt: new Date(now.getTime() + 9_000),
    });
    await expect(stateOf(due.id)).resolves.toMatchObject({
      objectRemovedAt: first,
    });
  });

  it("refuses, in the database itself, a removal time on an intent that is not abandoned", async () => {
    const userId = await createUser();
    const live = await seedIntent(userId, { cleanupDueInMs: 1_000 });
    await expect(
      database
        .update(uploadIntents)
        .set({ objectRemovedAt: now })
        .where(eq(uploadIntents.id, live.id)),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "upload_intents_removal_requires_abandoned",
      },
    });
  });

  it("skips an intent another transaction holds, such as a completion in flight, instead of waiting for it", async () => {
    const userId = await createUser();
    const held = await seedIntent(userId, { cleanupDueInMs: -3_000 });
    const free = await seedIntent(userId, { cleanupDueInMs: -2_000 });
    let holding: () => void = () => undefined;
    const locked = new Promise<void>((resolve) => (holding = resolve));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const holder = database.transaction(async (transaction) => {
      await transaction
        .select({ id: uploadIntents.id })
        .from(uploadIntents)
        .where(eq(uploadIntents.id, held.id))
        .for("update");
      holding();
      await gate;
    });
    await locked;
    try {
      const outcome = await Promise.race([
        claim(),
        new Promise<"blocked">((resolve) =>
          setTimeout(() => resolve("blocked"), 3_000),
        ),
      ]);
      if (outcome === "blocked")
        throw new Error("The claim waited for a locked row.");
      expect(outcome.map(({ intentId }) => intentId)).toEqual([free.id]);
    } finally {
      release();
      await holder;
    }
    await expect(stateOf(held.id)).resolves.toMatchObject({
      state: "reserved",
    });
  });

  it("serves concurrent passes without losing or corrupting any intent", async () => {
    const userId = await createUser();
    const seeded = await Promise.all(
      Array.from({ length: 8 }, () => seedIntent(userId)),
    );
    const results = await Promise.all([claim(8), claim(8), claim(8)]);
    const claimed = new Set(results.flat().map(({ intentId }) => intentId));
    // Together the passes reach every intent, and each one ends up abandoned exactly once; a pass
    // that sees another's pending removal may return it too, which is harmless because the delete and
    // the removal record are both idempotent.
    expect([...claimed].sort()).toEqual(seeded.map(({ id }) => id).sort());
    for (const { id } of seeded)
      await expect(stateOf(id)).resolves.toEqual({
        objectRemovedAt: null,
        state: "abandoned",
      });
  });

  it("cannot be completed, re-reserved, or released once abandoned", async () => {
    const userId = await createUser();
    const intent = await seedIntent(userId, { state: "failed" });
    await claim();
    // Inside the original upload window, so only the abandoned state can refuse the completion.
    const insideWindow = new Date(now.getTime() - 3 * 86_400_000);
    await expect(
      intentRepository.findForCompletion({
        intentId: intent.id,
        now: insideWindow,
        userId,
      }),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(
      intentRepository.reserve({
        activeLimit: 2,
        byteLength: 100,
        cleanupEligibleAt: new Date(now.getTime() + 86_400_000),
        contentType: "image/png",
        createdAt: now,
        expiresAt: new Date(now.getTime() + 900_000),
        id: createUuidV7(),
        idempotencyKey: idempotencyKeySchema.parse(`seed-${intent.id}`),
        objectKey: intent.objectKey,
        purpose: "creator-avatar",
        requestFingerprint: "a".repeat(64),
        retainUntil: new Date(now.getTime() + 2_592_000_000),
        storageProviderId: providerId,
        userId,
      }),
    ).resolves.toEqual({ kind: "conflict" });
    await intentRepository.markSigningFailed({
      failedAt: now,
      intentId: intent.id,
      userId,
    });
    await expect(stateOf(intent.id)).resolves.toMatchObject({
      state: "abandoned",
    });
  });
});
