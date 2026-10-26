import type { EnvironmentDefinition } from "./definitions.ts";

// Where the rewards chain's fee levels come from, kept apart from the other definitions to keep each file small.
// `parseRewardsChainEnvironment` reads them.
export const feeSourceEnvironmentDefinitions = [
  {
    key: "REWARDS_FEE_API_FORMAT",
    description:
      "Which public explorer the fee levels are taken from: mempool (mempool.space, its own recommended fees; the default) or blockstream (Blockstream's Esplora, an estimate per confirmation target). Each carries its own address for the network the deployment runs on. Blank is mempool.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_FEE_RATE_SAT_VB",
    description:
      "A fee rate in sat/vB (up to 1000) used for every step when the explorer cannot be read; without it a step that cannot be priced fails. It is a number you keep honest, not a live one (the step's total fee is still held to REWARDS_MAX_FEE_SATS). Blank has no fallback.",
    exposure: "server",
    required: false,
    secret: false,
  },
] as const satisfies readonly EnvironmentDefinition[];
