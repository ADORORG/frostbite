import { parseObjectKey } from "@ador/object-storage/contracts";
import { createUuidV7 } from "@ador/shared/identifiers";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AbandonedUpload,
  UploadCleanupRepository,
} from "../src/application/cleanup-repository.ts";
import { createUploadCleanupService } from "../src/application/cleanup-service.ts";
import { dependencies, now } from "./support/intent-service-fixtures.ts";

const policy = {
  cleanupBatchSize: 7,
  cleanupConcurrency: 2,
  cleanupDeleteTimeoutMs: 1_000,
  cleanupRetryBaseMs: 60_000,
  cleanupRetryMaxMs: 400_000,
};

function upload(attempts = 0): AbandonedUpload {
  return {
    attempts,
    intentId: createUuidV7(),
    objectKey: parseObjectKey(`drafts/${createUuidV7()}`),
  };
}

function setup(
  claimed: readonly AbandonedUpload[],
  overrides: Partial<typeof policy> = {},
) {
  const { storage } = dependencies();
  const repository: UploadCleanupRepository = {
    claim: vi.fn(async () => claimed),
    markObjectRemoved: vi.fn(async () => undefined),
    recordFailure: vi.fn(async () => undefined),
  };
  const service = createUploadCleanupService({
    clock: () => now,
    policy: { ...policy, ...overrides },
    repository,
    storage,
  });
  return { repository, service, storage };
}

afterEach(() => vi.useRealTimers());

describe("abandoned upload cleanup", () => {
  it("claims one policy-sized batch at the clock time", async () => {
    const { repository, service, storage } = setup([]);
    await expect(service.sweep()).resolves.toEqual({
      claimed: 0,
      failures: [],
      removed: 0,
    });
    expect(repository.claim).toHaveBeenCalledExactlyOnceWith({
      limit: 7,
      now,
      storageProviderId: storage.providerId,
    });
  });

  it("deletes each claimed private object, then records the removal", async () => {
    const [first, second] = [upload(), upload()];
    const { repository, service, storage } = setup([first, second], {
      cleanupConcurrency: 1,
    });
    await expect(service.sweep()).resolves.toMatchObject({
      claimed: 2,
      removed: 2,
    });
    expect(vi.mocked(storage.delete).mock.calls).toEqual([
      [{ key: first.objectKey, scope: "private" }],
      [{ key: second.objectKey, scope: "private" }],
    ]);
    expect(vi.mocked(repository.markObjectRemoved).mock.calls).toEqual([
      [{ intentId: first.intentId, removedAt: now }],
      [{ intentId: second.intentId, removedAt: now }],
    ]);
    expect(repository.recordFailure).not.toHaveBeenCalled();
  });

  it("does not record a removal before the delete has succeeded", async () => {
    const claimed = upload();
    const { repository, service, storage } = setup([claimed]);
    const order: string[] = [];
    vi.mocked(storage.delete).mockImplementation(async () => {
      order.push("delete");
    });
    vi.mocked(repository.markObjectRemoved).mockImplementation(async () => {
      order.push("mark");
    });
    await service.sweep();
    expect(order).toEqual(["delete", "mark"]);
  });

  it("reports a failed delete, puts it off, and carries on with the rest", async () => {
    const [broken, fine] = [upload(), upload()];
    const { repository, service, storage } = setup([broken, fine]);
    vi.mocked(storage.delete).mockRejectedValueOnce(new Error("bucket down"));
    await expect(service.sweep()).resolves.toEqual({
      claimed: 2,
      failures: [{ intentId: broken.intentId, message: "bucket down" }],
      removed: 1,
    });
    expect(vi.mocked(repository.markObjectRemoved).mock.calls).toEqual([
      [{ intentId: fine.intentId, removedAt: now }],
    ]);
    expect(vi.mocked(repository.recordFailure).mock.calls).toEqual([
      [
        {
          intentId: broken.intentId,
          retryAt: new Date(now.getTime() + 60_000),
        },
      ],
    ]);
  });

  it("waits twice as long after each failure, up to the maximum", async () => {
    const claimed = [0, 1, 2, 3, 40].map(upload);
    const { repository, service, storage } = setup(claimed);
    vi.mocked(storage.delete).mockRejectedValue(new Error("no"));
    await service.sweep();
    const waits = vi
      .mocked(repository.recordFailure)
      .mock.calls.map(
        ([{ intentId, retryAt }]) =>
          [
            claimed.findIndex((c) => c.intentId === intentId),
            retryAt.getTime() - now.getTime(),
          ] as const,
      )
      .sort(([a], [b]) => a - b)
      .map(([, wait]) => wait);
    expect(waits).toEqual([60_000, 120_000, 240_000, 400_000, 400_000]);
  });

  it("reports a failure to record the removal, so the next pass retries the delete", async () => {
    const claimed = upload();
    const { repository, service } = setup([claimed]);
    vi.mocked(repository.markObjectRemoved).mockRejectedValueOnce("lost");
    await expect(service.sweep()).resolves.toMatchObject({
      failures: [{ intentId: claimed.intentId, message: "Removal failed." }],
      removed: 0,
    });
    expect(repository.recordFailure).toHaveBeenCalledTimes(1);
  });

  it("still reports the failure when putting the retry off cannot be recorded", async () => {
    const claimed = upload();
    const { repository, service, storage } = setup([claimed]);
    vi.mocked(storage.delete).mockRejectedValueOnce(new Error("down"));
    vi.mocked(repository.recordFailure).mockRejectedValueOnce(new Error("db"));
    await expect(service.sweep()).resolves.toMatchObject({
      failures: [{ message: "down" }],
    });
  });

  it("lets a failure to claim reach the caller", async () => {
    const { repository, service } = setup([]);
    vi.mocked(repository.claim).mockRejectedValueOnce(new Error("db down"));
    await expect(service.sweep()).rejects.toThrow("db down");
  });
});

describe("a removal that hangs or is slow", () => {
  it("is given up on after the time limit, reported, and put off, while the others are removed", async () => {
    vi.useFakeTimers();
    const [hung, fine] = [upload(), upload()];
    const { repository, service, storage } = setup([hung, fine]);
    vi.mocked(storage.delete).mockImplementation(({ key }) =>
      key === hung.objectKey ? new Promise(() => undefined) : Promise.resolve(),
    );
    const swept = service.sweep();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(swept).resolves.toEqual({
      claimed: 2,
      failures: [{ intentId: hung.intentId, message: "Removal timed out." }],
      removed: 1,
    });
    expect(repository.recordFailure).toHaveBeenCalledTimes(1);
  });

  it("does not hold up the rest of the batch: removals run side by side, up to the concurrency", async () => {
    const claimed = [upload(), upload(), upload(), upload()];
    const { service, storage } = setup(claimed, { cleanupConcurrency: 2 });
    let running = 0;
    let peak = 0;
    vi.mocked(storage.delete).mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    });
    await expect(service.sweep()).resolves.toMatchObject({ removed: 4 });
    expect(peak).toBe(2);
  });

  it("never starts more workers than there are removals", async () => {
    const { service, storage } = setup([upload()], { cleanupConcurrency: 20 });
    await service.sweep();
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it("clears the time limit once the delete has finished", async () => {
    vi.useFakeTimers();
    const { service } = setup([upload()]);
    await service.sweep();
    expect(vi.getTimerCount()).toBe(0);
  });
});
