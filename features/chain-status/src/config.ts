import type { DelayPolicy, IndexingStatus } from "@ador/shared/chain";

// What the platform needs to tell anyone how far a chain's indexer has read: the chain it follows (none, where it follows no chain,
// and then nothing is shown), what counts as far behind, and how often a page asks again.
export interface ChainStatusConfig {
  readonly delay: Pick<DelayPolicy, "maxLagBlocks">;
  // The chain followed: its name, and a reading that rejects where the chain cannot be asked.
  readonly followed: {
    readonly displayName: string;
    indexing(): Promise<IndexingStatus>;
  } | null;
  // How often a page's lamp asks again, in milliseconds.
  readonly refreshMs: number;
}
