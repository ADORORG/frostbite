import { describe, expect, it, vi } from "vitest";

import type { UploadsApi } from "../../src/client/api-client.ts";
import { createAssetWatcher } from "../../src/client/asset-watcher.ts";
import { libraryAsset, processedAsset } from "../support/library-fixtures.ts";

const first = "018f22f2-9c1a-7b21-8c45-0000000000a1";
const second = "018f22f2-9c1a-7b21-8c45-0000000000a2";
const policy = { pollIntervalMs: 1, pollMaxAttempts: 3 };

function setup(read: UploadsApi["listAssets"]) {
  const listAssets = vi.fn(read);
  const watcher = createAssetWatcher({
    api: { listAssets },
    policy,
    sleep: async () => undefined,
  });
  return { listAssets, watcher };
}

describe("asset watcher", () => {
  it("answers for many assets with one read of the library per check", async () => {
    const { listAssets, watcher } = setup(async () => ({
      assets: [processedAsset({ id: first }), processedAsset({ id: second })],
      nextCursor: null,
    }));
    const signal = new AbortController().signal;
    const results = await Promise.all([
      watcher.watch(first, signal),
      watcher.watch(second, signal),
    ]);
    expect(results.map((result) => result.kind)).toEqual([
      "settled",
      "settled",
    ]);
    expect(listAssets).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting while an asset is not in a final state, and gives up after the allowed checks", async () => {
    const { listAssets, watcher } = setup(async () => ({
      assets: [libraryAsset({ id: first })],
      nextCursor: null,
    }));
    await expect(
      watcher.watch(first, new AbortController().signal),
    ).resolves.toEqual({ kind: "timed-out" });
    expect(listAssets).toHaveBeenCalledTimes(policy.pollMaxAttempts);
  });

  it("settles each asset on its own: one is ready while the other is still being processed", async () => {
    let reads = 0;
    const { watcher } = setup(async () => {
      reads += 1;
      return {
        assets: [
          processedAsset({ id: first }),
          reads < 2
            ? libraryAsset({ id: second })
            : processedAsset({ id: second }),
        ],
        nextCursor: null,
      };
    });
    const signal = new AbortController().signal;
    const [one, two] = await Promise.all([
      watcher.watch(first, signal),
      watcher.watch(second, signal),
    ]);
    expect([one.kind, two.kind]).toEqual(["settled", "settled"]);
    expect(reads).toBe(2);
  });

  it("stops watching an asset whose upload was cancelled, and rejects with the reason", async () => {
    const { watcher } = setup(async () => ({
      assets: [libraryAsset({ id: first }), processedAsset({ id: second })],
      nextCursor: null,
    }));
    const controller = new AbortController();
    const cancelled = watcher.watch(first, controller.signal);
    const other = watcher.watch(second, new AbortController().signal);
    controller.abort(new Error("cancelled"));
    await expect(cancelled).rejects.toThrow("cancelled");
    await expect(other).resolves.toMatchObject({ kind: "settled" });
  });

  it("does not keep reading the library for an asset nobody waits on any more", async () => {
    const { listAssets, watcher } = setup(async () => ({
      assets: [libraryAsset({ id: first })],
      nextCursor: null,
    }));
    const controller = new AbortController();
    const watched = watcher.watch(first, controller.signal);
    controller.abort(new Error("cancelled"));
    await expect(watched).rejects.toThrow("cancelled");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listAssets.mock.calls.length).toBeLessThan(policy.pollMaxAttempts);
  });

  it("rejects at once for a signal that is already aborted", async () => {
    const { listAssets, watcher } = setup(async () => ({
      assets: [],
      nextCursor: null,
    }));
    const controller = new AbortController();
    controller.abort(new Error("gone"));
    await expect(watcher.watch(first, controller.signal)).rejects.toThrow(
      "gone",
    );
    expect(listAssets).not.toHaveBeenCalled();
  });

  it("fails everything being watched when the library cannot be read, and works again afterwards", async () => {
    let healthy = false;
    const { watcher } = setup(async () => {
      if (!healthy) throw new Error("offline");
      return { assets: [processedAsset({ id: first })], nextCursor: null };
    });
    const signal = new AbortController().signal;
    const failures = await Promise.allSettled([
      watcher.watch(first, signal),
      watcher.watch(second, signal),
    ]);
    expect(failures.map(({ status }) => status)).toEqual([
      "rejected",
      "rejected",
    ]);
    healthy = true;
    await expect(watcher.watch(first, signal)).resolves.toMatchObject({
      kind: "settled",
    });
  });
});
