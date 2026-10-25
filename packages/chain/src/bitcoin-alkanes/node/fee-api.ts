import { jsonValueSchema, type FeeRate } from "@ador/shared/chain";

import { NodeUnavailableError } from "./errors.ts";
import { recordOf, type JsonRecord } from "./json.ts";

// Just what the fee source needs of `fetch` (a plain GET), so tests and other runtimes can supply their own.
export type GetLike = (
  url: string,
  init: { readonly signal: AbortSignal },
) => Promise<{
  // `unknown` is what a response body is; `createFeeApi` validates it as JSON before anything reads it.
  readonly json: () => Promise<unknown>;
  readonly ok: boolean;
  readonly status: number;
}>;

export interface FeeApiOptions {
  readonly fetch: GetLike;
  readonly timeoutMs: number;
  // The explorer's address up to its network, without the path: `https://mempool.space/signet`.
  readonly url: string;
}

// Where the fee levels are, and which confirmation target each is for. mempool's "recommended fees" (the REST API's
// `GET /api/v1/fees/recommended`, https://mempool.space/docs/api/rest#get-recommended-fees) names the next block, about half an hour
// (three blocks), about an hour (six blocks) and "economy" (anything slower).
const path = "/api/v1/fees/recommended";
const levels = [
  { field: "fastestFee", upToBlocks: 1 },
  { field: "halfHourFee", upToBlocks: 3 },
  { field: "hourFee", upToBlocks: 6 },
] as const;
const slowest = "economyFee";

function rateOf(fees: JsonRecord, field: string): number {
  const rate = fees[field];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new NodeUnavailableError(
      `The fee source's ${field} is not a positive number.`,
    );
  }
  return rate;
}

function fieldFor(target: number): string {
  return levels.find((level) => target <= level.upToBlocks)?.field ?? slowest;
}

export interface FeeApi {
  feeRates(targets: readonly number[]): Promise<readonly FeeRate[]>;
}

// The fee rate to pay for a confirmation target, from a public explorer's recommendation. It is used in place of the node's own
// estimates, which on the hosted test networks follow a few outlying transactions (150 to 272 sat/vB on signet, up to 588,235 on
// testnet4 on 2026-10-24) while the explorer recommends 1. A source that cannot be reached or whose answer is not the expected shape
// stops the answer: a rate is never guessed and the node's estimate is not substituted.
export function createFeeApi(options: FeeApiOptions): FeeApi {
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error(
      "The fee source timeout must be a positive whole number of milliseconds.",
    );
  }
  const address = `${options.url.replace(/\/+$/u, "")}${path}`;
  return {
    feeRates: async (targets) => {
      let fees: JsonRecord;
      try {
        const response = await options.fetch(address, {
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        if (!response.ok) {
          throw new NodeUnavailableError(
            `The fee source answered HTTP ${response.status}.`,
          );
        }
        fees = recordOf(
          jsonValueSchema.parse(await response.json()),
          "fee recommendation",
        );
      } catch (error) {
        if (error instanceof NodeUnavailableError) throw error;
        throw new NodeUnavailableError("The fee source could not be reached.");
      }
      return targets.map((target) => ({
        satPerVb: rateOf(fees, fieldFor(target)),
        targetBlocks: target,
      }));
    },
  };
}

// A fee rate the operator has set, for every confirmation target, in place of asking a source. For when no explorer can be reached from
// where the platform runs; the rate is theirs to keep honest, so it is a setting they must choose, never a fallback the adapter takes by
// itself when a source fails.
export function createFixedFeeApi(satPerVb: number): FeeApi {
  if (!Number.isFinite(satPerVb) || satPerVb <= 0) {
    throw new Error("A fixed fee rate must be a positive number of sat/vB.");
  }
  return {
    feeRates: async (targets) =>
      targets.map((target) => ({ satPerVb, targetBlocks: target })),
  };
}
