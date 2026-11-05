import type { BetaNetwork } from "@frostbite/shared/chain";
import { parseBetaNetworkEnvironment } from "@repo/config/beta-network";
import {
  parseRewardsChainEnvironment,
  type RewardsChainEnvironment,
} from "@repo/config/rewards-chain";

import { messageOf, type CheckResult } from "../result.ts";

export const configurationName = "Settings (REWARDS_*)";

// Whether the deployment's settings describe a rewards chain, by the same parser the platform boots with, so a setting the platform
// would refuse is refused here with the platform's own message.
export function checkConfiguration(source: NodeJS.ProcessEnv): {
  readonly betaNetwork: BetaNetwork | null;
  readonly environment: RewardsChainEnvironment | null;
  readonly result: CheckResult;
} {
  try {
    const betaNetwork = parseBetaNetworkEnvironment(source);
    const environment = parseRewardsChainEnvironment(source);
    if (environment === null) {
      return {
        betaNetwork,
        environment,
        result: {
          detail:
            "REWARDS_CHAIN_RPC_URL is not set, so the platform offers no claims and no administration.",
          name: configurationName,
          verdict: "fail",
        },
      };
    }
    return {
      betaNetwork,
      environment,
      result: {
        detail: `Network ${betaNetwork}, node ${new URL(environment.rpcUrl).host}, fee ceiling ${environment.maxFeeSats} sats, timeout ${environment.rpcTimeoutMs} ms.`,
        name: configurationName,
        verdict: "pass",
      },
    };
  } catch (error) {
    return {
      betaNetwork: null,
      environment: null,
      result: {
        detail: messageOf(error),
        name: configurationName,
        verdict: "fail",
      },
    };
  }
}
