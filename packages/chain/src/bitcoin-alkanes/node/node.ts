import type { JsonValue } from "@ador/shared/chain";

import type { AlkaneId } from "./alkane-id.ts";
import { fromHex } from "./hex.ts";
import {
  decodeSimulateResponse,
  encodeBytecodeRequest,
  encodeSimulateRequest,
  type ViewResult,
} from "./messages.ts";
import { NodeUnavailableError, type JsonRpc } from "./transport.ts";

// What the adapter asks of an Alkanes node, and nothing more. Every answer is validated here, so nothing above this file
// handles an unchecked response.
export interface AlkanesNode {
  // The stored code of a contract, or null when nothing is deployed there.
  bytecode(target: AlkaneId): Promise<Uint8Array | null>;
  height(): Promise<number>;
  // Runs a read-only call at the indexed head. `ok: false` means the call reverted or the contract does not exist.
  view(
    target: AlkaneId,
    opcode: bigint,
    inputs: readonly bigint[],
  ): Promise<ViewResult>;
}

function text(value: JsonValue, what: string): string {
  if (typeof value !== "string") {
    throw new NodeUnavailableError(`The node's ${what} is not text.`);
  }
  return value;
}

export function createRpcNode(rpc: JsonRpc): AlkanesNode {
  const head = async (): Promise<number> => {
    const height = await rpc.call("esplora_blocks:tip:height", []);
    if (typeof height !== "number" || !Number.isInteger(height) || height < 0) {
      throw new NodeUnavailableError(
        "The node's height is not a block height.",
      );
    }
    return height;
  };
  return {
    bytecode: async (target) => {
      const hex = text(
        await rpc.call("metashrew_view", [
          "getbytecode",
          encodeBytecodeRequest(target),
          "latest",
        ]),
        "bytecode",
      );
      const code = fromHex(hex);
      return code.length === 0 ? null : code;
    },
    height: head,
    view: async (target, opcode, inputs) => {
      const request = encodeSimulateRequest(
        await head(),
        target,
        opcode,
        inputs,
      );
      const answer = text(
        await rpc.call("metashrew_view", ["simulate", request, "latest"]),
        "simulation",
      );
      return decodeSimulateResponse(answer);
    },
  };
}
