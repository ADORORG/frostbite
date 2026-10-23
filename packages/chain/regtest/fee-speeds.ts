import type { FeeSpeedPolicy } from "@ador/shared/chain";

// The speeds a person may choose between; the regtest drive only needs them to exist.
export const feeSpeeds: FeeSpeedPolicy = {
  fast: { approxMinutes: 30, targetBlocks: 3 },
  lightning: { approxMinutes: 15, targetBlocks: 1 },
  medium: { approxMinutes: 60, targetBlocks: 6 },
  slow: { approxMinutes: 250, targetBlocks: 25 },
};
