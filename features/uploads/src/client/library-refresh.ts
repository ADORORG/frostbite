import type { LibraryAsset } from "@frostbite/shared/uploads";

import { isTerminalAsset } from "./asset-poller.ts";
import type { UploadClientPolicy } from "./client-policy.ts";

type RefreshPolicy = Pick<
  UploadClientPolicy,
  "minimumRefreshDelayMs" | "pollIntervalMs" | "signedUrlRefreshMarginMs"
>;

// When the library should next reload, or null if nothing needs it. Two reasons exist: an asset is
// still being processed (check again soon), or a signed rendition URL is about to expire (reload
// before images break). The earlier one wins, and a floor prevents a tight loop on clock skew.
export function nextLibraryRefreshDelay(
  assets: readonly Pick<LibraryAsset, "derivatives" | "processingState">[],
  now: number,
  policy: RefreshPolicy,
): number | null {
  const delays: number[] = [];
  if (assets.some((asset) => !isTerminalAsset(asset)))
    delays.push(policy.pollIntervalMs);
  for (const asset of assets)
    for (const { expiresAt } of asset.derivatives)
      delays.push(
        Date.parse(expiresAt) - now - policy.signedUrlRefreshMarginMs,
      );
  if (delays.length === 0) return null;
  return Math.max(policy.minimumRefreshDelayMs, Math.min(...delays));
}
