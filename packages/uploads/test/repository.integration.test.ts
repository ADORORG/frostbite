import {
  authUsers,
  assets,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
  uploadIntents,
} from "@ador/database";
import { idempotencyKeySchema } from "@ador/shared/http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleUploadIntentRepository } from "../src/adapters/drizzle-repository.ts";
import type { UploadIntentView } from "../src/application/repository.ts";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { providerIdSchema } from "@ador/shared/providers";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzleUploadIntentRepository(database);
const now = new Date("2026-09-13T12:00:00.000Z");

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(assets);
  await database.delete(uploadIntents);
  await database.delete(authUsers);
});
afterAll(async () => pool.end());

async function user() {
  const id = createUuidV7();
  await database.insert(authUsers).values({
    email: `${id}@example.test`,
    id,
    name: "Uploader",
  });
  return id;
}

function reservation(
  userId: Awaited<ReturnType<typeof user>>,
  key: string,
  intent: UploadIntentView,
) {
  return {
    ...intent,
    activeLimit: 2,
    cleanupEligibleAt: new Date(now.getTime() + 86_400_000),
    createdAt: now,
    idempotencyKey: idempotencyKeySchema.parse(key),
    requestFingerprint: "a".repeat(64),
    retainUntil: new Date(now.getTime() + 2_592_000_000),
    userId,
  };
}

function intent(suffix: string): UploadIntentView {
  return {
    byteLength: 100,
    contentType: "image/png",
    expiresAt: new Date(now.getTime() + 900_000),
    id: createUuidV7(),
    objectKey: parseObjectKey(`drafts/${suffix}`),
    purpose: "creator-avatar",
    storageProviderId: providerIdSchema.parse("test-object-storage"),
  };
}

describe("upload intent persistence", () => {
  it("replays matching requests and rejects idempotency drift", async () => {
    const userId = await user();
    const input = reservation(userId, "upload-request-0001", intent("one"));
    await expect(repository.reserve(input)).resolves.toMatchObject({
      kind: "reserved",
    });
    await expect(repository.reserve(input)).resolves.toMatchObject({
      intent: { id: input.id },
      kind: "replayed",
    });
    await expect(
      repository.reserve({ ...input, requestFingerprint: "b".repeat(64) }),
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("keeps two users' identical idempotency keys apart, so neither is handed the other's intent", async () => {
    const [first, second] = [await user(), await user()];
    const mine = reservation(first, "upload-request-0001", intent("mine"));
    const theirs = reservation(second, "upload-request-0001", intent("theirs"));
    await expect(repository.reserve(mine)).resolves.toMatchObject({
      intent: { id: mine.id },
      kind: "reserved",
    });
    await expect(repository.reserve(theirs)).resolves.toMatchObject({
      intent: { id: theirs.id },
      kind: "reserved",
    });
    await expect(repository.reserve(theirs)).resolves.toMatchObject({
      intent: { id: theirs.id, objectKey: theirs.objectKey },
      kind: "replayed",
    });
  });

  it("serializes concurrent reservations at the configured quota", async () => {
    const userId = await user();
    const attempts = ["one", "two", "three"].map((suffix, index) =>
      repository.reserve(
        reservation(userId, `upload-request-000${index + 1}`, intent(suffix)),
      ),
    );
    const results = await Promise.all(attempts);
    expect(results.filter(({ kind }) => kind === "reserved")).toHaveLength(2);
    expect(
      results.filter(({ kind }) => kind === "quota-exceeded"),
    ).toHaveLength(1);
  });

  it("releases and safely retries a failed signing reservation", async () => {
    const userId = await user();
    const input = reservation(userId, "upload-request-0001", intent("retry"));
    const first = await repository.reserve(input);
    if (first.kind !== "reserved") throw new Error("Expected reservation");
    await repository.markSigningFailed({
      failedAt: new Date(now.getTime() + 1),
      intentId: first.intent.id,
      userId,
    });
    await expect(repository.reserve(input)).resolves.toMatchObject({
      intent: { id: first.intent.id },
      kind: "reserved",
    });
  });

  it("does not count an expired reservation toward the active quota", async () => {
    const userId = await user();
    const expired = reservation(
      userId,
      "upload-request-0001",
      intent("expired"),
    );
    await repository.reserve({
      ...expired,
      expiresAt: new Date(now.getTime() - 1),
    });
    const attempts = ["two", "three"].map((suffix, index) =>
      repository.reserve(
        reservation(userId, `upload-request-000${index + 2}`, intent(suffix)),
      ),
    );
    const results = await Promise.all(attempts);
    expect(results.every(({ kind }) => kind === "reserved")).toBe(true);
  });

  it("rejects reuse of an expired idempotency reservation", async () => {
    const userId = await user();
    const input = reservation(
      userId,
      "upload-request-0001",
      intent("expired-key"),
    );
    await repository.reserve({
      ...input,
      expiresAt: new Date(now.getTime() - 1),
    });
    await expect(repository.reserve(input)).resolves.toEqual({
      kind: "conflict",
    });
  });

  it("cannot release another user's reservation", async () => {
    const ownerId = await user();
    const otherUserId = await user();
    const input = reservation(ownerId, "upload-request-0001", intent("owned"));
    await repository.reserve(input);
    await repository.markSigningFailed({
      failedAt: new Date(now.getTime() + 1),
      intentId: input.id,
      userId: otherUserId,
    });
    const [stored] = await database
      .select({ state: uploadIntents.state })
      .from(uploadIntents);
    expect(stored?.state).toBe("reserved");
  });
});
