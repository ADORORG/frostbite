import { z } from "zod";

// How fast a person wants a transaction confirmed, in the words they choose between. Each speed is a block target (the fee rate the
// node quotes for confirming within that many blocks) and an honest, approximate wait in minutes; both are decisions, so they come
// from policy (`FeeSpeedPolicy`) and are never written where a transaction is built.
export const feeSpeeds = ["slow", "medium", "fast", "lightning"] as const;
export type FeeSpeed = (typeof feeSpeeds)[number];
export const feeSpeedSchema = z.enum(feeSpeeds);

// The public explorers fee levels can be taken from (`REWARDS_FEE_API_FORMAT`). Each is one adapter in `@frostbite/chain` (`fee-sources`), keyed
// by this list, so a name without an adapter cannot be configured and an adapter without a name cannot exist. An adapter carries its own
// address for each network.
// - `mempool`: mempool.space's recommendation by name;
// - `blockstream`: Blockstream's Esplora, an estimate for each confirmation target.
export const feeApiFormats = ["mempool", "blockstream"] as const;
export type FeeApiFormat = (typeof feeApiFormats)[number];
export const feeApiFormatSchema = z.enum(feeApiFormats);

export interface FeeSpeedSetting {
  // About how long the wait is, in minutes, as it is told to a person ("about 15 minutes"). An estimate, never a promise.
  readonly approxMinutes: number;
  // The fee rate is taken for confirmation within this many blocks.
  readonly targetBlocks: number;
}
export type FeeSpeedPolicy = Readonly<Record<FeeSpeed, FeeSpeedSetting>>;

// A policy is usable when every speed has a positive block target and wait, faster speeds do not wait longer than slower ones, and no
// two speeds share a target (the choice would then mean nothing).
export function assertFeeSpeedPolicy(policy: FeeSpeedPolicy): void {
  let previous: FeeSpeedSetting | null = null;
  for (const speed of feeSpeeds) {
    const setting = policy[speed];
    if (
      !Number.isInteger(setting.targetBlocks) ||
      setting.targetBlocks < 1 ||
      !Number.isFinite(setting.approxMinutes) ||
      setting.approxMinutes <= 0
    ) {
      throw new Error(
        `The ${speed} fee speed needs a positive whole block target and a positive wait.`,
      );
    }
    if (
      previous !== null &&
      (setting.targetBlocks >= previous.targetBlocks ||
        setting.approxMinutes >= previous.approxMinutes)
    ) {
      throw new Error(
        `The ${speed} fee speed must be faster than the one before it (fewer blocks, a shorter wait).`,
      );
    }
    previous = setting;
  }
}

// The block target a speed stands for.
export const targetBlocksOf = (
  policy: FeeSpeedPolicy,
  speed: FeeSpeed,
): number => policy[speed].targetBlocks;

// What a node quoted for one block target, in satoshis per virtual byte.
export const feeRateSchema = z
  .object({
    satPerVb: z.number().positive().finite(),
    targetBlocks: z.number().int().positive(),
  })
  .strict()
  .readonly();
export type FeeRate = z.infer<typeof feeRateSchema>;

// The fee markets as any page is told of them: the rate for each speed, how long it is about to take, and where the chain is. Public:
// a fact about the chain. `none`: no chain to follow. `unavailable`: there is one and it could not be asked.
export const chainFeesSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("none") }).strict(),
  z
    .object({
      chain: z.string().min(1).max(64),
      state: z.literal("unavailable"),
    })
    .strict(),
  z
    .object({
      chain: z.string().min(1).max(64),
      observedAt: z.iso.datetime({ offset: true }),
      quotes: z
        .array(
          z
            .object({
              approxMinutes: z.number().positive(),
              satPerVb: z.number().positive().finite(),
              speed: feeSpeedSchema,
              targetBlocks: z.number().int().positive(),
              // Whether even the smallest step could be sent at this rate without passing `maxFeeSats`. Where it is false no
              // step can be, however small, and the speed is not offered.
              withinLimit: z.boolean(),
            })
            .strict(),
        )
        .length(feeSpeeds.length),
      // The most any one step may pay in fees, in satoshis; the platform refuses a step above it.
      maxFeeSats: z.number().int().positive(),
      state: z.literal("ok"),
      // Absent where the rates were read but the tip could not be.
      tipHeight: z.number().int().nonnegative().optional(),
    })
    .strict(),
]);

// How a built transaction's fee came about, told with it: the rate the chain quoted when it was priced, the speed asked for and the
// wait that speed stands for. Optional because an adapter that does not price by rate (or a transaction built before) has none.
export const feeDetailSchema = z
  .object({
    approxMinutes: z.number().positive().finite().optional(),
    satPerVb: z.number().positive().finite(),
    speed: feeSpeedSchema.optional(),
  })
  .strict()
  .readonly();
export type FeeDetail = z.infer<typeof feeDetailSchema>;

export const chainFeesInputSchema = z.object({}).strict();

export const chainFeesRoute = {
  method: "GET",
  operationId: "getChainFees",
  path: "/api/v1/chain/fees",
} as const;

export type ChainFees = z.infer<typeof chainFeesSchema>;
export type FeeQuoteView = Extract<
  ChainFees,
  { state: "ok" }
>["quotes"][number];

// What a speed is measured against to tell whether it can be offered: the most a step may pay, and how large the smallest step is.
export interface FeeLimit {
  readonly smallestStepVbytes: number;
  readonly maxFeeSats: number;
}

// The quotes for every speed, in the order of `feeSpeeds`, from what the node quoted per block target. A speed the node had no quote
// for is a reason to say the market is unavailable, never a guessed rate.
export function quotesFor(
  policy: FeeSpeedPolicy,
  rates: readonly FeeRate[],
  limit: FeeLimit,
): FeeQuoteView[] | null {
  const quotes: FeeQuoteView[] = [];
  for (const speed of feeSpeeds) {
    const { approxMinutes, targetBlocks } = policy[speed];
    const rate = rates.find(
      (candidate) => candidate.targetBlocks === targetBlocks,
    );
    if (rate === undefined) return null;
    quotes.push({
      approxMinutes,
      satPerVb: rate.satPerVb,
      speed,
      targetBlocks,
      withinLimit:
        feeAtRate(rate.satPerVb, limit.smallestStepVbytes) <= limit.maxFeeSats,
    });
  }
  return quotes;
}

// What a transaction of `vbytes` costs at a rate, in satoshis, rounded up (a fee is never rounded down below what is needed).
export const feeAtRate = (satPerVb: number, vbytes: number): number =>
  Math.ceil(satPerVb * vbytes);
