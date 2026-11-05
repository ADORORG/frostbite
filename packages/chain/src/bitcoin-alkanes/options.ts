import {
  assertFeeSpeedPolicy,
  feeSpeeds,
  targetBlocksOf,
  type FeeDetail,
  type FeeSpeed,
  type FeeSpeedPolicy,
} from "@frostbite/shared/chain";

import {
  alkaneIdLimit,
  sequenceReach,
  type TemplateSequence,
} from "./admin/free-address.ts";

// What sending and watching a transaction needs beyond the node: the policy values, all from configuration.
export interface TransactionOptions {
  // Below this a change output is not worth making; the remainder is paid as fee.
  readonly changeDustSats: bigint;
  // What the claim output (output 0) carries: above the dust limit, so the collectible has somewhere to land.
  readonly claimOutputSats: bigint;
  // Confirmation target, in blocks, the fee rate is taken for when no speed was chosen.
  readonly feeTargetBlocks: number;
  // The speeds a person may choose, each a block target; a transaction built for a speed takes the rate for its target.
  readonly feeSpeeds: FeeSpeedPolicy;
  // How long a built transaction may be signed for.
  readonly lifetimeMs: number;
  readonly now: () => Date;
  // Random bytes, for choosing where a template goes.
  readonly random: (length: number) => Uint8Array;
  // Names the node in the evidence an observation records.
  readonly providerId: string;
  // Where a new template's address is drawn from (see `freeTemplateAddress`).
  readonly templateSequence: TemplateSequence;
}

// The block target a transaction is priced for: the speed the person chose, or the usual one when none was.
export function feeTargetFor(
  options: Pick<TransactionOptions, "feeSpeeds" | "feeTargetBlocks">,
  speed: FeeSpeed | undefined,
): number {
  return speed === undefined
    ? options.feeTargetBlocks
    : targetBlocksOf(options.feeSpeeds, speed);
}

// How a fee came about, for the person who is shown it: the rate the node quoted and, when it is known, the speed and its wait. The speed
// is the one chosen, or the one the usual block target stands for; none when the usual target is not one of the speeds.
export function feeDetailFor(
  options: Pick<TransactionOptions, "feeSpeeds" | "feeTargetBlocks">,
  speed: FeeSpeed | undefined,
  satPerVb: number,
): FeeDetail {
  const named =
    speed ??
    feeSpeeds.find(
      (candidate) =>
        options.feeSpeeds[candidate].targetBlocks === options.feeTargetBlocks,
    );
  return {
    ...(named === undefined
      ? {}
      : {
          approxMinutes: options.feeSpeeds[named].approxMinutes,
          speed: named,
        }),
    satPerVb,
  };
}

export function assertTransactionOptions(options: TransactionOptions): void {
  assertFeeSpeedPolicy(options.feeSpeeds);
  for (const [name, value] of [
    ["feeTargetBlocks", options.feeTargetBlocks],
    ["lifetimeMs", options.lifetimeMs],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive whole number.`);
    }
  }
  if (
    !Number.isInteger(options.templateSequence.attempts) ||
    options.templateSequence.attempts < 1 ||
    options.templateSequence.first < 0n ||
    options.templateSequence.window < 1n
  ) {
    throw new Error(
      "templateSequence needs a first number of zero or more, a window of at least one and a positive whole number of attempts.",
    );
  }
  if (sequenceReach(options.templateSequence) >= alkaneIdLimit) {
    throw new Error(
      "templateSequence reaches past the largest number an address can hold.",
    );
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
