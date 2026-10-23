import {
  createJsonRpc,
  createRpcNode,
  type FetchLike,
} from "@ador/chain/bitcoin-alkanes";

import type { DelayPolicy } from "@ador/shared/chain";

import { betaChains } from "../../../configs/beta-chains.ts";
import {
  defaultFeeTargetBlocks,
  rewardsPolicy,
} from "../../../configs/rewards-policy.ts";
import { chainName, checkChain } from "./checks/chain.ts";
import { checkConfiguration } from "./checks/configuration.ts";
import { checkFee, feeName } from "./checks/fee.ts";
import {
  authTokenFactory,
  checkFactory,
  checkIndexer,
  factoryName,
  indexerName,
} from "./checks/indexer.ts";
import { checkTemplates, type TemplateSpec } from "./checks/templates.ts";
import type { CheckResult } from "./result.ts";

// The decisions the checks hold the setup to; the platform's own policy unless a test supplies another.
export interface PreflightPolicy {
  readonly delay: DelayPolicy;
  readonly feeTargetBlocks: number;
  readonly templates: readonly TemplateSpec[];
}

export interface PreflightPlatform {
  readonly fetch: FetchLike;
  readonly readFile: (path: string) => Promise<Uint8Array>;
}

const skipped = (name: string): CheckResult => ({
  detail: "Not checked: the settings are not usable.",
  name,
  verdict: "skipped",
});

// Everything that can be checked on the way to a first run on the beta's test network without sending a transaction, in the order a person would fix
// it. Nothing here signs, broadcasts or writes.
export async function runPreflight(
  source: NodeJS.ProcessEnv,
  platform: PreflightPlatform,
  policy: PreflightPolicy = {
    ...rewardsPolicy,
    feeTargetBlocks: defaultFeeTargetBlocks,
  },
): Promise<readonly CheckResult[]> {
  const { betaNetwork, environment, result } = checkConfiguration(source);
  const templates = await checkTemplates(
    environment?.templatesDirectory ?? null,
    policy.templates,
    platform.readFile,
  );
  if (environment === null || betaNetwork === null) {
    return [
      result,
      templates.result,
      skipped(chainName),
      skipped(indexerName),
      skipped(factoryName),
      skipped(feeName),
    ];
  }
  const node = createRpcNode(
    createJsonRpc({
      fetch: platform.fetch,
      headers: environment.rpcHeaders,
      timeoutMs: environment.rpcTimeoutMs,
      url: environment.rpcUrl,
    }),
  );
  return [
    result,
    templates.result,
    await checkChain(node, betaChains[betaNetwork].chain.chainId),
    await checkIndexer(node, policy.delay),
    await checkFactory(node, authTokenFactory),
    await checkFee(
      node,
      policy.feeTargetBlocks,
      environment.maxFeeSats,
      templates.found,
    ),
  ];
}
