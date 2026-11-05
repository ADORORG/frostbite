import type { AlkanesNode } from "@frostbite/chain/bitcoin-alkanes";

import { messageOf, type CheckResult } from "../result.ts";

export const chainName = "The node serves the configured chain";

// CAIP-2 names a Bitcoin chain by the first sixteen bytes (thirty-two hex digits) of its genesis block hash.
const chainIdHexDigits = 32;

// Signet and testnet4 write addresses alike, so a node of the wrong one would build, sign and send without complaint. The only
// thing that tells them apart is the genesis block, so this reads it and compares it with the chain the platform is set to use.
export async function checkChain(
  node: Pick<AlkanesNode, "blockHash">,
  expectedChainId: string,
): Promise<CheckResult> {
  let genesis: string;
  try {
    genesis = await node.blockHash(0);
  } catch (error) {
    return { detail: messageOf(error), name: chainName, verdict: "unverified" };
  }
  const served = `bip122:${genesis.slice(0, chainIdHexDigits)}`;
  return served === expectedChainId
    ? {
        detail: `Genesis block ${genesis}, which is ${expectedChainId}.`,
        name: chainName,
        verdict: "pass",
      }
    : {
        detail: `The node's genesis block is ${genesis} (${served}); the platform is set to use ${expectedChainId}. Point the node address at that chain, or change BETA_NETWORK.`,
        name: chainName,
        verdict: "fail",
      };
}
