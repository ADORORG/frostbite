import type { AlkaneId } from "../node/alkane-id.ts";
import { encipherProtostone, varintList } from "./protostone.ts";
import { runestoneScript } from "./runestone.ts";

// The protocol tag Alkanes registers (`alkanes-support`'s `AlkaneMessageContext::protocol_tag`).
const alkanesProtocolTag = 1n;

export interface Call {
  // The arguments after the opcode.
  readonly inputs: readonly bigint[];
  readonly opcode: bigint;
  readonly target: AlkaneId;
}

export interface CallRouting {
  // The output the call's results go to, and the output tokens go to if the call reverts.
  readonly pointer: number;
  readonly refund: number;
  // The output unallocated tokens go to. For a call that must be handed tokens (the auth token), the output that carries the call.
  readonly unallocated: number;
}

// The `OP_RETURN` output that makes a call to an Alkane.
export function callScript(call: Call, routing: CallRouting): Uint8Array {
  const message = varintList([
    call.target.block,
    call.target.tx,
    call.opcode,
    ...call.inputs,
  ]);
  return runestoneScript(
    routing.unallocated,
    encipherProtostone({
      message,
      pointer: routing.pointer,
      protocolTag: alkanesProtocolTag,
      refund: routing.refund,
    }),
  );
}
