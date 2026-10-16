import { z } from "zod";

const blankAsUnset = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

// Parses text that must be a JSON document of a known shape. `unknown` is what parsing untrusted text yields; it is accepted
// only through the schema.
function parseJson<Output>(
  key: string,
  text: string,
  schema: z.ZodType<Output>,
): Output {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error(`${key} is not valid JSON.`);
  }
  const result = schema.safeParse(document);
  if (!result.success) {
    throw new Error(
      `${key} is not valid: ${result.error.issues.map(({ message }) => message).join("; ")}`,
    );
  }
  return result.data;
}

// An Alkane is `block:tx`; the chain adapter reads it in full, this only keeps a typo from getting that far.
const alkaneText = z.string().regex(/^\d+:\d+$/u, "an Alkane is block:tx");

const templateIdsSchema = z
  .object({
    "game-rewards": alkaneText,
    "milestone-collectible": alkaneText,
  })
  .strict();

const contractsSchema = z.record(
  z.string().min(1),
  z
    .object({
      id: alkaneText,
      maxDrawingBytes: z.number().int().positive(),
    })
    .strict(),
);

export interface RewardsContractSetting {
  readonly id: string;
  readonly maxDrawingBytes: bigint;
}

export interface RewardsTemplateSettings {
  // Where each template is published, or will be.
  readonly ids: Readonly<z.infer<typeof templateIdsSchema>>;
  // The directory holding each template's built `.wasm`, named after its crate.
  readonly directory: string;
}

// What the platform needs to reach the chain its games' rewards contracts are on. Everything here differs between a developer's
// machine, a preview and a deployment.
export interface RewardsChainEnvironment {
  // The deployed contract of each game, by game id.
  readonly contracts: ReadonlyMap<string, RewardsContractSetting>;
  // The most a player's claim or a staff step may pay in fee, in satoshis.
  readonly maxFeeSats: bigint;
  // `closed` keeps the platform from building, sending or watching anything on the chain until the owner opens it.
  readonly releaseGate: "closed" | "open";
  readonly rpcTimeoutMs: number;
  readonly rpcUrl: string;
  // Absent: the platform cannot publish templates or create games, and says so.
  readonly templates: RewardsTemplateSettings | null;
}

export const rewardsChainEnvironmentSchema = z.object({
  REWARDS_CHAIN_RELEASE_GATE: z.enum(["closed", "open"]).default("closed"),
  REWARDS_CHAIN_RPC_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15_000),
  REWARDS_CHAIN_RPC_URL: z.url({ protocol: /^https?$/u }),
  REWARDS_CONTRACTS: z.string().optional(),
  REWARDS_MAX_FEE_SATS: z.coerce.bigint().positive(),
  REWARDS_TEMPLATES_DIR: z.string().optional(),
  REWARDS_TEMPLATE_IDS: z.string().optional(),
});

// The rewards chain the deployment is set to use, or null when none is: with no node address the platform offers no claims and no
// administration, and the pages say so. A node address without the rest is a misconfiguration and stops boot.
export function parseRewardsChainEnvironment(
  source: NodeJS.ProcessEnv,
): RewardsChainEnvironment | null {
  const url = blankAsUnset(source.REWARDS_CHAIN_RPC_URL);
  if (url === undefined) return null;
  const parsed = rewardsChainEnvironmentSchema.parse({
    REWARDS_CHAIN_RELEASE_GATE: blankAsUnset(source.REWARDS_CHAIN_RELEASE_GATE),
    REWARDS_CHAIN_RPC_TIMEOUT_MS: blankAsUnset(
      source.REWARDS_CHAIN_RPC_TIMEOUT_MS,
    ),
    REWARDS_CHAIN_RPC_URL: url,
    REWARDS_CONTRACTS: blankAsUnset(source.REWARDS_CONTRACTS),
    REWARDS_MAX_FEE_SATS: blankAsUnset(source.REWARDS_MAX_FEE_SATS),
    REWARDS_TEMPLATES_DIR: blankAsUnset(source.REWARDS_TEMPLATES_DIR),
    REWARDS_TEMPLATE_IDS: blankAsUnset(source.REWARDS_TEMPLATE_IDS),
  });
  const directory = parsed.REWARDS_TEMPLATES_DIR;
  const ids = parsed.REWARDS_TEMPLATE_IDS;
  if ((directory === undefined) !== (ids === undefined)) {
    throw new Error(
      "REWARDS_TEMPLATES_DIR and REWARDS_TEMPLATE_IDS are set together or not at all.",
    );
  }
  const contracts =
    parsed.REWARDS_CONTRACTS === undefined
      ? {}
      : parseJson(
          "REWARDS_CONTRACTS",
          parsed.REWARDS_CONTRACTS,
          contractsSchema,
        );
  return {
    contracts: new Map(
      Object.entries(contracts).map(([game, { id, maxDrawingBytes }]) => [
        game,
        { id, maxDrawingBytes: BigInt(maxDrawingBytes) },
      ]),
    ),
    maxFeeSats: parsed.REWARDS_MAX_FEE_SATS,
    releaseGate: parsed.REWARDS_CHAIN_RELEASE_GATE,
    rpcTimeoutMs: parsed.REWARDS_CHAIN_RPC_TIMEOUT_MS,
    rpcUrl: parsed.REWARDS_CHAIN_RPC_URL,
    templates:
      directory === undefined || ids === undefined
        ? null
        : {
            directory,
            ids: parseJson("REWARDS_TEMPLATE_IDS", ids, templateIdsSchema),
          },
  };
}
