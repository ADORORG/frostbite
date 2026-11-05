import type { LibraryAsset } from "@frostbite/shared/uploads";

import type { UploadsApi } from "./api-client.ts";
import type { UploadClientPolicy } from "./client-policy.ts";

const terminalStates: readonly LibraryAsset["processingState"][] = [
  "processed",
  "rejected",
  "unprocessable",
];

export function isTerminalAsset(
  asset: Pick<LibraryAsset, "processingState">,
): boolean {
  return terminalStates.includes(asset.processingState);
}

export type PollSettings = Pick<
  UploadClientPolicy,
  "pollIntervalMs" | "pollMaxAttempts"
>;

export type PollResult =
  | { readonly asset: LibraryAsset; readonly kind: "settled" }
  | { readonly kind: "timed-out" };

// Waits for validation and processing to reach a final state. The library is the single read model,
// so this reuses it instead of a second status endpoint. Gives up after a fixed number of checks.
export async function waitForAsset(input: {
  readonly api: Pick<UploadsApi, "listAssets">;
  readonly assetId: string;
  readonly policy: PollSettings;
  readonly signal: AbortSignal;
  readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}): Promise<PollResult> {
  const { api, assetId, policy, signal, sleep } = input;
  for (let attempt = 0; attempt < policy.pollMaxAttempts; attempt += 1) {
    if (attempt > 0) await sleep(policy.pollIntervalMs, signal);
    signal.throwIfAborted();
    const { assets } = await api.listAssets({ signal });
    const asset = assets.find(({ id }) => id === assetId);
    if (asset !== undefined && isTerminalAsset(asset))
      return { asset, kind: "settled" };
  }
  return { kind: "timed-out" };
}
