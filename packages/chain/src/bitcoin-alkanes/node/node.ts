import type { AlkaneId } from "./alkane-id.ts";
import { NodeUnavailableError } from "./errors.ts";
import type { FeeApi } from "./fee-api.ts";
import { createEsploraClient, type EsploraClient } from "./esplora.ts";
import { createIndexerClient, type IndexerClient } from "./indexer.ts";
import type { ViewResult } from "./messages.ts";
import type { JsonRpc } from "./transport.ts";

// What the adapter asks of an Alkanes node, and nothing more: the Bitcoin side (`EsploraClient`) and the indexer side
// (`IndexerClient`, with views run at the chain's current height). Every answer is validated where it is read, so nothing above
// this boundary handles an unchecked response.
export interface AlkanesNode extends EsploraClient {
  bytecode: IndexerClient["bytecode"];
  holdings: IndexerClient["holdings"];
  indexedHeight: IndexerClient["indexedHeight"];
  trace: IndexerClient["trace"];
  // Runs a call that changes nothing, at the chain's current height, optionally inside a given transaction. `ok: false` means the
  // call reverted or the contract does not exist.
  view(
    target: AlkaneId,
    opcode: bigint,
    inputs: readonly bigint[],
    transaction?: Uint8Array,
  ): Promise<ViewResult>;
}

// `fees`, when given, answers every fee rate in place of the node's own estimates.
export function createRpcNode(rpc: JsonRpc, fees?: FeeApi): AlkanesNode {
  const esplora = createEsploraClient(rpc);
  const indexer = createIndexerClient(rpc);
  return {
    ...esplora,
    ...(fees === undefined
      ? {}
      : {
          feeRate: async (target: number) => {
            const [only] = await fees.feeRates([target]);
            if (only === undefined) {
              throw new NodeUnavailableError(
                "The fee source has no rate for the target.",
              );
            }
            return only.satPerVb;
          },
          feeRates: fees.feeRates,
        }),
    bytecode: indexer.bytecode,
    holdings: indexer.holdings,
    indexedHeight: indexer.indexedHeight,
    trace: indexer.trace,
    view: async (target, opcode, inputs, transaction) =>
      indexer.view({
        height: (await esplora.tip()).height,
        inputs,
        opcode,
        target,
        ...(transaction === undefined ? {} : { transaction }),
      }),
  };
}
