import type { ChainConfig, ChainRef, ChainRole } from "@frostbite/shared/chain";

import { simulatedFamily } from "./transaction.ts";

const finalized = { kind: "finalized" } as const;

// A chain configuration for a simulated chain, so a feature test can boot the registry against the
// second family with one call. The record spells out every operation, so adding an operation to
// `chainOperations` fails the type check here until it is given a policy.
export function simulatedChainConfig(
  chainId: ChainRef,
  role: ChainRole = "test",
): ChainConfig {
  return {
    chainId,
    confirmations: {
      deploy: finalized,
      mint: finalized,
      "mint-milestone": finalized,
      "publish-template": finalized,
      "define-milestone": finalized,
      "set-claims-paused": finalized,
      transfer: finalized,
    },
    displayName: `Simulated ${chainId}`,
    enabled: true,
    family: simulatedFamily,
    releaseGate: "closed",
    role,
  };
}
