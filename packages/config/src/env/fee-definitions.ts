import type { EnvironmentDefinition } from "./definitions.ts";

// Where the rewards chain's fee levels come from, kept apart from the other definitions to keep each file small.
// `parseRewardsChainEnvironment` reads them.
export const feeSourceEnvironmentDefinitions = [
  {
    key: "REWARDS_FEE_API_URL",
    description:
      "Another explorer to take fee levels from, answering like mempool.space (its address up to the network, e.g. https://example.org/signet), for when the network's default explorer cannot be reached from here. Blank uses the default. Not together with REWARDS_FEE_RATE_SAT_VB.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_FEE_RATE_SAT_VB",
    description:
      "A fee rate in sat/vB used for every step instead of asking an explorer (up to 1000; the step's total fee is still held to REWARDS_MAX_FEE_SATS). It is a fixed number you keep honest, not a live one. Blank asks the explorer. Not together with REWARDS_FEE_API_URL.",
    exposure: "server",
    required: false,
    secret: false,
  },
] as const satisfies readonly EnvironmentDefinition[];
