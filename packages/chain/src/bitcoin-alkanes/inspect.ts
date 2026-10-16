import { crypto } from "bitcoinjs-lib";
import type { ContractInspection, ContractRef } from "@ador/shared/chain";

import { toHex } from "./node/hex.ts";
import { parseAlkaneId } from "./node/alkane-id.ts";
import type { AlkanesNode } from "./node/node.ts";

// Whether code is deployed at a contract, and its hash: the SHA-256 of the stored wasm, the figure the template build
// (`contracts/templates/build.sh`, `release.json`) publishes, so a deployed contract can be matched to a released template.
export async function inspectContract(
  node: AlkanesNode,
  ref: ContractRef,
): Promise<ContractInspection> {
  const id = parseAlkaneId(ref.id);
  if (id === null) return { codeHash: null, exists: false, ref };
  const code = await node.bytecode(id);
  return code === null
    ? { codeHash: null, exists: false, ref }
    : { codeHash: toHex(crypto.sha256(code)), exists: true, ref };
}
