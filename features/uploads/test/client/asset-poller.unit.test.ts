import type { LibraryAsset } from "@ador/shared/uploads";
import { describe, expect, it, vi } from "vitest";

import {
  isTerminalAsset,
  waitForAsset,
} from "../../src/client/asset-poller.ts";
import {
  assetId,
  libraryAsset,
  processedAsset,
} from "../support/library-fixtures.ts";

const policy = { pollIntervalMs: 100, pollMaxAttempts: 4 };
const signal = new AbortController().signal;

function setup(...pages: ReturnType<typeof libraryAsset>[][]) {
  const listAssets = vi.fn();
  for (const assets of pages)
    listAssets.mockResolvedValueOnce({ assets, truncated: false });
  const sleep = vi.fn(async () => undefined);
  return { api: { listAssets }, listAssets, sleep };
}

describe("asset polling", () => {
  it("classifies final states", () => {
    const states: LibraryAsset["processingState"][] = [
      "pending-validation",
      "validated",
      "rejected",
      "processed",
      "unprocessable",
    ];
    expect(
      states.map((processingState) => isTerminalAsset({ processingState })),
    ).toEqual([false, false, true, true, true]);
  });

  it("returns immediately, without sleeping, when the asset is already final", async () => {
    const asset = processedAsset();
    const { api, listAssets, sleep } = setup([asset]);
    await expect(
      waitForAsset({ api, assetId, policy, signal, sleep }),
    ).resolves.toEqual({ asset, kind: "settled" });
    expect(listAssets).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits between checks until the asset settles", async () => {
    const final = libraryAsset({
      processingState: "rejected",
      rejectionReason: "malformed",
    });
    const { api, listAssets, sleep } = setup(
      [libraryAsset()],
      [libraryAsset({ processingState: "validated" })],
      [final],
    );
    await expect(
      waitForAsset({ api, assetId, policy, signal, sleep }),
    ).resolves.toEqual({ asset: final, kind: "settled" });
    expect(listAssets).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([
      [100, signal],
      [100, signal],
    ]);
  });

  it("ignores other assets and gives up after the attempt budget", async () => {
    const other = processedAsset({
      id: "018f22f2-9c1a-7b21-8c45-0000000000ff",
    });
    const { api, listAssets, sleep } = setup(
      [other],
      [libraryAsset()],
      [],
      [libraryAsset()],
    );
    await expect(
      waitForAsset({ api, assetId, policy, signal, sleep }),
    ).resolves.toEqual({ kind: "timed-out" });
    expect(listAssets).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("stops as soon as the signal aborts, before another request", async () => {
    const controller = new AbortController();
    const { api, listAssets } = setup([libraryAsset()], [libraryAsset()]);
    const sleep = vi.fn(async () => controller.abort());
    await expect(
      waitForAsset({ api, assetId, policy, signal: controller.signal, sleep }),
    ).rejects.toThrow();
    expect(listAssets).toHaveBeenCalledTimes(1);
  });

  it("propagates a failing request", async () => {
    const api = { listAssets: vi.fn().mockRejectedValue(new Error("down")) };
    await expect(
      waitForAsset({
        api,
        assetId,
        policy,
        signal,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow("down");
  });
});
