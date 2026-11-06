import { lagOf, type IndexingStatus } from "@frostbite/shared/chain";

// How far along the platform's reading of the chain is, from 0 to 1, over the last `windowBlocks` blocks: the whole chain's height would
// show 40 blocks behind as 99.99%, and so as complete. Nothing is ahead of the tip, and a lag of the whole window or more shows as 0.
export function syncProgress(
  status: Pick<IndexingStatus, "indexedHeight" | "tipHeight">,
  windowBlocks: number,
): number {
  return 1 - Math.min(lagOf(status), windowBlocks) / windowBlocks;
}
