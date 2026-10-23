import { Transaction } from "bitcoinjs-lib";
import type { ChainRef, TransactionIntent } from "@ador/shared/chain";

import { validateBitcoinAddress } from "../bitcoin/address.ts";
import type { ContractGateway } from "../ports.ts";
import { gameRewardsOpcodes } from "./abi.ts";
import { freeTemplateAddress } from "./admin/free-address.ts";
import { nativeAsset, servedChain, type ServedChain } from "./chains.ts";
import { inspectContract } from "./inspect.ts";
import { milestoneKey } from "./milestone-key.ts";
import { parseAlkaneId } from "./node/alkane-id.ts";
import { fromHex } from "./node/hex.ts";
import { feeTargetFor, type TransactionOptions } from "./options.ts";
import { claimScript } from "./tx/claim-call.ts";
import { estimateVsize, feeFor } from "./tx/fees.ts";

type Simulated = Awaited<ReturnType<ContractGateway["simulate"]>>;

function refused(reason: string): Simulated {
  return { ok: false, reason };
}

// The contract's own words for a refusal ("claim limit reached"), without the runtime's wrapping.
function contractReason(error: string): string {
  const parts = error.split("Error: ");
  return (
    (parts[parts.length - 1] ?? error).trim() ||
    "The contract refused the claim."
  );
}

// The transaction a claim would be sent in, as far as the contract reads it: output 0 pays the claimant.
function claimTransaction(senderScript: Uint8Array): Uint8Array {
  const transaction = new Transaction();
  transaction.version = 2;
  // A transaction with no inputs cannot be told from a SegWit one when it is read back, so it carries a placeholder input.
  transaction.addInput(new Uint8Array(32), 0xffffffff);
  transaction.addOutput(senderScript, 546n);
  return Uint8Array.from(transaction.toBuffer());
}

export function createContractGateway(
  chains: ReadonlyMap<ChainRef, ServedChain>,
  options: TransactionOptions,
): ContractGateway {
  const simulateClaim = async (
    intent: Extract<TransactionIntent, { operation: "mint-milestone" }>,
  ): Promise<Simulated> => {
    const { network, node } = servedChain(chains, intent.chain);
    const game = parseAlkaneId(intent.contract.id);
    const sender = validateBitcoinAddress(intent.sender.value, network);
    if (game === null || !sender.ok)
      return refused("The contract or the sender is not valid for this chain.");
    const answer = await node.view(
      game,
      gameRewardsOpcodes.claim,
      [milestoneKey(intent.milestoneId)],
      claimTransaction(fromHex(sender.value.scriptHex)),
    );
    if (!answer.ok) return refused(contractReason(answer.error));
    const call = claimScript(game, milestoneKey(intent.milestoneId));
    // The fee for the smallest claim the sender could make: one input, the claimant output, the call, and change.
    const fee = feeFor(
      estimateVsize(
        [sender.value.type],
        [sender.value.type, sender.value.type],
        call.length,
      ),
      await node.feeRate(feeTargetFor(options, intent.feeSpeed)),
    );
    return {
      fee: { asset: nativeAsset(intent.chain), baseUnits: fee },
      ok: true,
    };
  };
  return {
    freeTemplateAddress: async (chain, taken) =>
      freeTemplateAddress(
        servedChain(chains, chain).node,
        options.templateSequence,
        taken,
      ),
    inspect: async (ref) =>
      inspectContract(servedChain(chains, ref.chain).node, ref),
    simulate: async (intent) =>
      intent.operation === "mint-milestone"
        ? simulateClaim(intent)
        : refused(
            `The bitcoin-alkanes adapter simulates milestone claims only, not ${intent.operation}.`,
          ),
  };
}
