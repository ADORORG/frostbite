import { parseObjectKey } from "@ador/object-storage/contracts";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import type {
  AbandonedUpload,
  UploadCleanupRepository,
} from "../src/application/cleanup-repository.ts";
import { createUploadCleanupService } from "../src/application/cleanup-service.ts";
import { dependencies, now } from "./support/intent-service-fixtures.ts";

function upload(): AbandonedUpload {
  return {
    intentId: createUuidV7(),
    objectKey: parseObjectKey(`drafts/${createUuidV7()}`),
  };
}

function setup(claimed: readonly AbandonedUpload[], batchSize = 7) {
  const { storage } = dependencies();
  const repository: UploadCleanupRepository = {
    claim: vi.fn(async () => claimed),
    markObjectRemoved: vi.fn(async () => undefined),
  };
  const service = createUploadCleanupService({
    clock: () => now,
    policy: { cleanupBatchSize: batchSize },
    repository,
    storage,
  });
  return { repository, service, storage };
}

describe("abandoned upload cleanup", () => {
  it("claims one policy-sized batch at the clock time", async () => {
    const { repository, service, storage } = setup([], 7);
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
    const { repository, service, storage } = setup([first, second]);
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

  it("reports a failed delete without recording it and carries on with the rest", async () => {
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
  });

  it("reports a failure to record the removal, so the next pass retries the delete", async () => {
    const claimed = upload();
    const { repository, service } = setup([claimed]);
    vi.mocked(repository.markObjectRemoved).mockRejectedValueOnce("lost");
    await expect(service.sweep()).resolves.toMatchObject({
      failures: [{ intentId: claimed.intentId, message: "Removal failed." }],
      removed: 0,
    });
  });

  it("lets a failure to claim reach the caller", async () => {
    const { repository, service } = setup([]);
    vi.mocked(repository.claim).mockRejectedValueOnce(new Error("db down"));
    await expect(service.sweep()).rejects.toThrow("db down");
  });
});
