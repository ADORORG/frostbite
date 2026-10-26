import { feeApiFormatSchema, type FeeApiFormat } from "@ador/shared/chain";
import { z } from "zod";

const blankAsUnset = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

// What the platform needs to reach the chain its games' rewards contracts are on. Only what differs between a developer's machine,
// a preview and a deployment is here; where a template or a game's contract is on the chain is recorded when staff publish it.
export interface RewardsChainEnvironment {
  // Where the fee levels come from. `default`: the network's own explorer (see `configs/beta-chains.ts`). `explorer`: another explorer
  // of the format named by `REWARDS_FEE_API_FORMAT` (mempool.space's by default), for when the default cannot be reached from where the platform runs. `fixed`: a rate the operator
  // sets, used for every step instead of asking anyone (shown as fixed wherever it is shown; the step's total fee is still held to
  // `maxFeeSats`).
  readonly feeSource:
    | { readonly kind: "default" }
    | {
        readonly format: FeeApiFormat;
        readonly kind: "explorer";
        readonly url: string;
      }
    | { readonly kind: "fixed"; readonly satPerVb: number };
  // The most a player's claim or a staff step may pay in fee, in satoshis.
  readonly maxFeeSats: bigint;
  // The header carrying the node's key, or empty when the node needs none. Secret.
  readonly rpcHeaders: Readonly<Record<string, string>>;
  readonly rpcTimeoutMs: number;
  readonly rpcUrl: string;
  // The directory of the built template code. Absent: the platform cannot publish templates or create games, and says so.
  readonly templatesDirectory: string | null;
}

// An HTTP field name is a token (RFC 9110 section 5.6.2); a key is visible ASCII, which every header value may carry.
const headerName = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/u;
const headerValue = /^[\x21-\x7e]+$/u;

// No fixed rate above this is believable on a hosted test network (outliers there have reached hundreds of sat/vB, not thousands); a
// larger number is a typo, such as a total in satoshis put where a rate belongs.
const MAXIMUM_FIXED_FEE_RATE = 1_000;

export const rewardsChainEnvironmentSchema = z
  .object({
    REWARDS_CHAIN_RPC_API_KEY: z.string().regex(headerValue).optional(),
    REWARDS_CHAIN_RPC_API_KEY_HEADER: z.string().regex(headerName).optional(),
    REWARDS_CHAIN_RPC_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15_000),
    REWARDS_CHAIN_RPC_URL: z.url({ protocol: /^https?$/u }),
    REWARDS_FEE_API_FORMAT: feeApiFormatSchema.optional(),
    REWARDS_FEE_API_URL: z.url({ protocol: /^https?$/u }).optional(),
    REWARDS_FEE_RATE_SAT_VB: z.coerce
      .number()
      .positive()
      .max(MAXIMUM_FIXED_FEE_RATE)
      .optional(),
    REWARDS_MAX_FEE_SATS: z.coerce.bigint().positive(),
    REWARDS_TEMPLATES_DIR: z.string().optional(),
  })
  .refine(
    (value) =>
      value.REWARDS_FEE_API_URL === undefined ||
      value.REWARDS_FEE_RATE_SAT_VB === undefined,
    {
      message:
        "REWARDS_FEE_API_URL and REWARDS_FEE_RATE_SAT_VB are alternatives: set one or neither.",
    },
  )
  .refine(
    (value) =>
      value.REWARDS_FEE_API_FORMAT === undefined ||
      value.REWARDS_FEE_API_URL !== undefined,
    {
      message:
        "REWARDS_FEE_API_FORMAT says how the explorer of REWARDS_FEE_API_URL answers, so it needs REWARDS_FEE_API_URL.",
    },
  )
  .refine(
    (value) =>
      (value.REWARDS_CHAIN_RPC_API_KEY === undefined) ===
      (value.REWARDS_CHAIN_RPC_API_KEY_HEADER === undefined),
    {
      message:
        "REWARDS_CHAIN_RPC_API_KEY and REWARDS_CHAIN_RPC_API_KEY_HEADER are set together or not at all.",
    },
  );

// The rewards chain the deployment is set to use, or null when none is: with no node address the platform offers no claims and no
// administration, and the pages say so. A node address without a fee ceiling is a misconfiguration and stops boot.
export function parseRewardsChainEnvironment(
  source: NodeJS.ProcessEnv,
): RewardsChainEnvironment | null {
  const url = blankAsUnset(source.REWARDS_CHAIN_RPC_URL);
  if (url === undefined) return null;
  const parsed = rewardsChainEnvironmentSchema.parse({
    REWARDS_CHAIN_RPC_API_KEY: blankAsUnset(source.REWARDS_CHAIN_RPC_API_KEY),
    REWARDS_CHAIN_RPC_API_KEY_HEADER: blankAsUnset(
      source.REWARDS_CHAIN_RPC_API_KEY_HEADER,
    ),
    REWARDS_CHAIN_RPC_TIMEOUT_MS: blankAsUnset(
      source.REWARDS_CHAIN_RPC_TIMEOUT_MS,
    ),
    REWARDS_CHAIN_RPC_URL: url,
    REWARDS_FEE_API_FORMAT: blankAsUnset(source.REWARDS_FEE_API_FORMAT),
    REWARDS_FEE_API_URL: blankAsUnset(source.REWARDS_FEE_API_URL),
    REWARDS_FEE_RATE_SAT_VB: blankAsUnset(source.REWARDS_FEE_RATE_SAT_VB),
    REWARDS_MAX_FEE_SATS: blankAsUnset(source.REWARDS_MAX_FEE_SATS),
    REWARDS_TEMPLATES_DIR: blankAsUnset(source.REWARDS_TEMPLATES_DIR),
  });
  const keyHeader = parsed.REWARDS_CHAIN_RPC_API_KEY_HEADER;
  const key = parsed.REWARDS_CHAIN_RPC_API_KEY;
  return {
    feeSource:
      parsed.REWARDS_FEE_RATE_SAT_VB !== undefined
        ? { kind: "fixed", satPerVb: parsed.REWARDS_FEE_RATE_SAT_VB }
        : parsed.REWARDS_FEE_API_URL !== undefined
          ? {
              format: parsed.REWARDS_FEE_API_FORMAT ?? "mempool",
              kind: "explorer",
              url: parsed.REWARDS_FEE_API_URL,
            }
          : { kind: "default" },
    maxFeeSats: parsed.REWARDS_MAX_FEE_SATS,
    rpcHeaders:
      keyHeader === undefined || key === undefined ? {} : { [keyHeader]: key },
    rpcTimeoutMs: parsed.REWARDS_CHAIN_RPC_TIMEOUT_MS,
    rpcUrl: parsed.REWARDS_CHAIN_RPC_URL,
    templatesDirectory: parsed.REWARDS_TEMPLATES_DIR ?? null,
  };
}
