import type {
  ChainRef,
  TransactionIntent,
  UnsignedTransaction,
} from "@ador/shared/chain";

import { validateBitcoinAddress } from "../bitcoin/address.ts";
import type { TransactionBuilder } from "../ports.ts";
import { psbtFormat } from "./format.ts";
import { milestoneKey } from "./milestone-key.ts";
import { nativeAsset, servedChain, type ServedChain } from "./chains.ts";
import { parseAlkaneId } from "./node/alkane-id.ts";
import { fromHex } from "./node/hex.ts";
import {
  assertTransactionOptions,
  type TransactionOptions,
} from "./options.ts";
import { selectCoins } from "./tx/coins.ts";
import { claimScript } from "./tx/claim-call.ts";
import { buildClaimPsbt } from "./tx/psbt.ts";
import { verifySignedClaim } from "./verify.ts";

// Why a transaction could not be built, as a code the caller can act on.
export class BuildRefusedError extends Error {
  constructor(
    readonly code:
      | "fee-above-limit"
      | "insufficient-funds"
      | "invalid-request"
      | "unsupported-operation",
    message: string,
  ) {
    super(message);
    this.name = "BuildRefusedError";
  }
}

export function createClaimBuilder(
  chains: ReadonlyMap<ChainRef, ServedChain>,
  options: TransactionOptions,
  family: UnsignedTransaction["family"],
): TransactionBuilder {
  assertTransactionOptions(options);
  return {
    build: async (intent: TransactionIntent, funding) => {
      if (intent.operation !== "mint-milestone") {
        throw new BuildRefusedError(
          "unsupported-operation",
          `The bitcoin-alkanes adapter builds milestone claims only, not ${intent.operation}.`,
        );
      }
      const { network, node } = servedChain(chains, intent.chain);
      const game = parseAlkaneId(intent.contract.id);
      const sender = validateBitcoinAddress(intent.sender.value, network);
      if (game === null || !sender.ok) {
        throw new BuildRefusedError(
          "invalid-request",
          "The contract or the sender is not valid for this chain.",
        );
      }
      const call = claimScript(game, milestoneKey(intent.milestoneId));
      const selection = selectCoins({
        changeDustSats: options.changeDustSats,
        claimOutputSats: options.claimOutputSats,
        feeRate: await node.feeRate(options.feeTargetBlocks),
        kind: sender.value.type,
        opReturnScriptLength: call.length,
        utxos: await node.utxos(sender.value.address),
      });
      if (selection === null) {
        throw new BuildRefusedError(
          "insufficient-funds",
          "The sender's confirmed balance cannot pay for the claim.",
        );
      }
      if (selection.fee > funding.maxFee.baseUnits) {
        throw new BuildRefusedError(
          "fee-above-limit",
          "The fee is above the maximum the platform allows.",
        );
      }
      const psbt = buildClaimPsbt({
        changeSats: selection.change,
        claimOutputSats: options.claimOutputSats,
        claimScript: call,
        inputs: selection.chosen,
        senderScript: fromHex(sender.value.scriptHex),
      });
      return {
        chain: intent.chain,
        family,
        format: psbtFormat,
        payload: psbt.toBase64(),
        summary: {
          chain: intent.chain,
          expiresAt: new Date(
            options.now().getTime() + options.lifetimeMs,
          ).toISOString(),
          fee: { asset: nativeAsset(intent.chain), baseUnits: selection.fee },
          milestone: { contract: intent.contract, id: intent.milestoneId },
          operation: "mint-milestone",
          recipient: intent.sender,
        },
      };
    },
    verifySigned: (unsigned, signed) =>
      verifySignedClaim(chains, unsigned, signed),
  };
}
