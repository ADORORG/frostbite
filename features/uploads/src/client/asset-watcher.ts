import type { UploadsApi } from "./api-client.ts";
import {
  isTerminalAsset,
  type PollResult,
  type PollSettings,
} from "./asset-poller.ts";

interface Watch {
  attempts: number;
  readonly fail: (error: unknown) => void;
  readonly settle: (result: PollResult) => void;
}

// Waits for many assets with one check at a time. A batch of images each asking the server on its own
// would make a request per image every interval; here one read of the library answers for all of them.
// Each asset gets the same number of checks as a single upload would (`pollMaxAttempts`), counted from
// when it started being watched. Only a few images are ever watched at once (the batch limits how many
// are being processed), so they all stay inside the newest assets one read returns.
export function createAssetWatcher(input: {
  readonly api: Pick<UploadsApi, "listAssets">;
  readonly policy: PollSettings;
  readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}) {
  const { api, policy, sleep } = input;
  const watches = new Map<string, Watch>();
  // Never aborted: the loop ends by itself when nothing is left to watch.
  const loopSignal = new AbortController().signal;
  let running = false;

  async function check() {
    const { assets } = await api.listAssets({ signal: loopSignal });
    for (const asset of assets) {
      const watch = watches.get(asset.id);
      if (watch === undefined || !isTerminalAsset(asset)) continue;
      watches.delete(asset.id);
      watch.settle({ asset, kind: "settled" });
    }
    for (const [assetId, watch] of watches) {
      watch.attempts += 1;
      if (watch.attempts < policy.pollMaxAttempts) continue;
      watches.delete(assetId);
      watch.settle({ kind: "timed-out" });
    }
  }

  async function loop() {
    running = true;
    try {
      while (watches.size > 0) {
        await sleep(policy.pollIntervalMs, loopSignal);
        await check();
      }
    } catch (error) {
      // A failed read fails everything being watched; each upload reports it and can be retried.
      for (const watch of watches.values()) watch.fail(error);
      watches.clear();
    } finally {
      running = false;
    }
  }

  return {
    watch(assetId: string, signal: AbortSignal): Promise<PollResult> {
      return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(signal.reason);
        const entry: Watch = { attempts: 0, fail: reject, settle: resolve };
        watches.set(assetId, entry);
        signal.addEventListener(
          "abort",
          () => {
            if (watches.get(assetId) === entry) watches.delete(assetId);
            reject(signal.reason);
          },
          { once: true },
        );
        if (!running) void loop();
      });
    },
  };
}
