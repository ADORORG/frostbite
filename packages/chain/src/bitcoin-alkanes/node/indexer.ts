import type { AlkaneId } from "./alkane-id.ts";
import { NodeUnavailableError } from "./errors.ts";
import { fromHex, toHex } from "./hex.ts";
import { decodeHoldings, type OutputHoldings } from "./holdings.ts";
import { textOf } from "./json.ts";
import {
  decodeSimulateResponse,
  encodeBytecodeRequest,
  encodeSimulateRequest,
  type SimulateRequest,
  type ViewResult,
} from "./messages.ts";
import { MessageWriter } from "./protobuf.ts";
import { decodeTraceOutcome, type TraceOutcome } from "./trace.ts";
import type { JsonRpc } from "./transport.ts";

// The Alkanes side of a node, over `metashrew_view`.
export interface IndexerClient {
  bytecode(target: AlkaneId): Promise<Uint8Array | null>;
  // The output at `txid:vout` (usual written id) and the Alkane tokens the indexer sees on it.
  holdings(txid: string, vout: number): Promise<OutputHoldings>;
  // The height the indexer has processed; behind the chain tip while it catches up.
  indexedHeight(): Promise<number>;
  // How the call a transaction made at `vout` ended. `txid` is the usual (display) transaction id.
  trace(txid: string, vout: number): Promise<TraceOutcome>;
  view(request: SimulateRequest): Promise<ViewResult>;
}

// The protocol Alkanes registers on Bitcoin (`AlkaneMessageContext::protocol_tag`), as the outpoint query names it.
const alkanesProtocol = 1n;

// The indexer keys a trace by the transaction id in the byte order Bitcoin hashes it, the reverse of the usual written form.
function outpoint(txid: string, vout: number): MessageWriter {
  const display = fromHex(txid);
  if (display.length !== 32) {
    throw new NodeUnavailableError("A transaction id is thirty-two bytes.");
  }
  return new MessageWriter()
    .bytesField(1, Uint8Array.from(display).reverse())
    .varint(2, BigInt(vout));
}

function outpointRequest(txid: string, vout: number): string {
  return `0x${toHex(outpoint(txid, vout).finish())}`;
}

function holdingsRequest(txid: string, vout: number): string {
  const protocol = new MessageWriter().varint(1, alkanesProtocol).finish();
  return `0x${toHex(outpoint(txid, vout).bytesField(3, protocol).finish())}`;
}

export function createIndexerClient(rpc: JsonRpc): IndexerClient {
  return {
    bytecode: async (target) => {
      const hex = textOf(
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
    holdings: async (txid, vout) =>
      decodeHoldings(
        textOf(
          await rpc.call("metashrew_view", [
            "protorunesbyoutpoint",
            holdingsRequest(txid, vout),
            "latest",
          ]),
          "holdings",
        ),
      ),
    indexedHeight: async () => {
      const text = textOf(
        await rpc.call("metashrew_height", []),
        "indexed height",
      );
      const height = Number(text);
      if (!/^\d+$/u.test(text) || !Number.isSafeInteger(height)) {
        throw new NodeUnavailableError(
          "The node's indexed height is not a block height.",
        );
      }
      return height;
    },
    trace: async (txid, vout) =>
      decodeTraceOutcome(
        textOf(
          await rpc.call("metashrew_view", [
            "trace",
            outpointRequest(txid, vout),
            "latest",
          ]),
          "trace",
        ),
      ),
    view: async (request) =>
      decodeSimulateResponse(
        textOf(
          await rpc.call("metashrew_view", [
            "simulate",
            encodeSimulateRequest(request),
            "latest",
          ]),
          "simulation",
        ),
      ),
  };
}
