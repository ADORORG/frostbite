import type {
  DelayPolicy,
  FeeRate,
  FeeSpeedPolicy,
  IndexingStatus,
} from "@ador/shared/chain";

// What the platform needs to tell anyone how far a chain's indexer has read: the chain it follows (none, where it follows no chain,
// and then nothing is shown), what counts as far behind, and how often a page asks again.
export interface ChainStatusConfig {
  // When a reading is told to have been taken.
  readonly now: () => Date;
  readonly delay: Pick<DelayPolicy, "maxLagBlocks">;
  // How large the smallest step is, in virtual bytes: only to tell whether any step could afford a speed (never shown as a cost).
  readonly smallestStepVbytes: number;
  // The speeds a fee can be paid at, each a block target and a wait, told next to the rate the chain quotes for it.
  readonly feeSpeeds: FeeSpeedPolicy;
  // The chain followed: its name, a reading of its indexer and a quote of its fee market, both of which reject where the chain cannot be
  // asked.
  readonly followed: {
    readonly displayName: string;
    feeRates(targets: readonly number[]): Promise<readonly FeeRate[]>;
    indexing(): Promise<IndexingStatus>;
    // The height of the chain's tip alone, asked when the indexer cannot be, so a failing indexer does not hide the block or the fees.
    tipHeight(): Promise<number>;
    // The most one step may pay in fees, in satoshis: what the platform refuses above, told so no speed is offered that no step could
    // afford.
    readonly maxFeeSats: number;
  } | null;
  // How often a page's lamp asks again, in milliseconds.
  readonly refreshMs: number;
  // How many blocks the sync bar spans (see `syncProgress`).
  readonly syncWindowBlocks: number;
}
