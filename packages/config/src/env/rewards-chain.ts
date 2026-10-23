import { z } from "zod";

const blankAsUnset = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

// What the platform needs to reach the chain its games' rewards contracts are on. Only what differs between a developer's machine,
// a preview and a deployment is here; where a template or a game's contract is on the chain is recorded when staff publish it.
export interface RewardsChainEnvironment {
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
    REWARDS_MAX_FEE_SATS: z.coerce.bigint().positive(),
    REWARDS_TEMPLATES_DIR: z.string().optional(),
  })
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
    REWARDS_MAX_FEE_SATS: blankAsUnset(source.REWARDS_MAX_FEE_SATS),
    REWARDS_TEMPLATES_DIR: blankAsUnset(source.REWARDS_TEMPLATES_DIR),
  });
  const keyHeader = parsed.REWARDS_CHAIN_RPC_API_KEY_HEADER;
  const key = parsed.REWARDS_CHAIN_RPC_API_KEY;
  return {
    maxFeeSats: parsed.REWARDS_MAX_FEE_SATS,
    rpcHeaders:
      keyHeader === undefined || key === undefined ? {} : { [keyHeader]: key },
    rpcTimeoutMs: parsed.REWARDS_CHAIN_RPC_TIMEOUT_MS,
    rpcUrl: parsed.REWARDS_CHAIN_RPC_URL,
    templatesDirectory: parsed.REWARDS_TEMPLATES_DIR ?? null,
  };
}
