import type {
  DelayPolicy,
  FeeRate,
  FeeSpeedPolicy,
  IndexingStatus,
} from "@ador/shared/chain";

// What the platform needs to tell anyone how far a chain's indexer has read: the chain it follows (none, where it follows no chain,
// and then nothing is shown), what counts as far behind, and how often a page asks again.
export interface ChainStatusConfig {
  readonly delay: Pick<DelayPolicy, "maxLagBlocks">;
  // The speeds a fee can be paid at, each a block target and a wait, told next to the rate the chain quotes for it.
  readonly feeSpeeds: FeeSpeedPolicy;
  // The chain followed: its name, a reading of its indexer and a quote of its fee market, both of which reject where the chain cannot be
  // asked.
  readonly followed: {
    readonly displayName: string;
    feeRates(targets: readonly number[]): Promise<readonly FeeRate[]>;
    indexing(): Promise<IndexingStatus>;
  } | null;
  // How often a page's lamp asks again, in milliseconds.
  readonly refreshMs: number;
}
