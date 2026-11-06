import type { AlkanesNode } from "@frostbite/chain/bitcoin-alkanes";
import {
  indexingHealth,
  lagOf,
  type DelayPolicy,
} from "@frostbite/shared/chain";

import { messageOf, type CheckResult } from "../result.ts";

export const indexerName = "Indexer is keeping up with the chain";
// Where the auth-token factory lives (`AUTH_TOKEN_FACTORY_ID`, 0xffed, in the reserved block 4). Mainnet has it; a fresh chain does not.
export const authTokenFactory = { block: 4n, tx: 65517n } as const;
type AuthTokenFactory = typeof authTokenFactory;

export const factoryName = "Auth-token factory exists";

// Read how far the indexer is behind the tip, judged by the same rule as the site's lamp.
export async function checkIndexer(
  node: Pick<AlkanesNode, "indexedHeight" | "tip">,
  delay: DelayPolicy,
): Promise<CheckResult> {
  try {
    const status = {
      indexedHeight: await node.indexedHeight(),
      tipHeight: (await node.tip()).height,
    };
    const health = indexingHealth(status, delay);
    return {
      detail: `Indexer at block ${status.indexedHeight}, chain tip ${status.tipHeight} (${lagOf(status)} behind, ${health}).`,
      name: indexerName,
      verdict: health === "delayed" ? "fail" : "pass",
    };
  } catch (error) {
    return {
      detail: messageOf(error),
      name: indexerName,
      verdict: "unverified",
    };
  }
}

// The game template calls the auth-token factory to make a game's auth token; without it creating a game reverts.
export async function checkFactory(
  node: Pick<AlkanesNode, "bytecode">,
  factory: AuthTokenFactory,
): Promise<CheckResult> {
  const id = `${factory.block}:${factory.tx}`;
  try {
    const code = await node.bytecode(factory);
    return code === null
      ? {
          detail: `Nothing is deployed at ${id}: creating a game's contract would revert until it is deployed.`,
          name: factoryName,
          verdict: "fail",
        }
      : {
          detail: `${id} holds ${code.length} bytes of code.`,
          name: factoryName,
          verdict: "pass",
        };
  } catch (error) {
    return {
      detail: `${id} could not be read: ${messageOf(error)}`,
      name: factoryName,
      verdict: "unverified",
    };
  }
}
