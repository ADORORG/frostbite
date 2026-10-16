// What sending and watching a transaction needs beyond the node: the policy values, all from configuration.
export interface TransactionOptions {
  // Below this a change output is not worth making; the remainder is paid as fee.
  readonly changeDustSats: bigint;
  // What the claim output (output 0) carries: above the dust limit, so the collectible has somewhere to land.
  readonly claimOutputSats: bigint;
  // Confirmation target, in blocks, the fee rate is taken for.
  readonly feeTargetBlocks: number;
  // How long a built transaction may be signed for.
  readonly lifetimeMs: number;
  readonly now: () => Date;
  // Names the node in the evidence an observation records.
  readonly providerId: string;
}

export function assertTransactionOptions(options: TransactionOptions): void {
  for (const [name, value] of [
    ["feeTargetBlocks", options.feeTargetBlocks],
    ["lifetimeMs", options.lifetimeMs],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive whole number.`);
    }
  }
  for (const [name, value] of [
    ["changeDustSats", options.changeDustSats],
    ["claimOutputSats", options.claimOutputSats],
  ] as const) {
    if (value < 1n) throw new Error(`${name} must be positive.`);
  }
  if (options.providerId.trim() === "")
    throw new Error("providerId must not be empty.");
}
