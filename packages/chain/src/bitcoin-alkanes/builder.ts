import type {
  ChainRef,
  TransactionIntent,
  UnsignedTransaction,
} from "@ador/shared/chain";

import { validateBitcoinAddress } from "../bitcoin/address.ts";
import { isAdminIntent, isAdminOperation } from "./admin/action.ts";
import { buildAdmin } from "./admin/build.ts";
import type { AdminOptions } from "./admin/templates.ts";
import { verifySignedAdmin } from "./admin/verify.ts";
import { BuildRefusedError } from "./build-refused.ts";
import type { TransactionBuilder } from "../ports.ts";
import { psbtFormat } from "./format.ts";
import { milestoneKey } from "./milestone-key.ts";
import { nativeAsset, servedChain, type ServedChain } from "./chains.ts";
import { parseAlkaneId } from "./node/alkane-id.ts";
import { fromHex } from "./node/hex.ts";
import {
  feeDetailFor,
  feeTargetFor,
  assertTransactionOptions,
  type TransactionOptions,
} from "./options.ts";
import { selectCoins, shortfallNote, type CoinRequest } from "./tx/coins.ts";
import { claimScript } from "./tx/claim-call.ts";
import { buildClaimPsbt } from "./tx/psbt.ts";
import { verifySignedClaim } from "./verify.ts";

export function createTransactionBuilder(
  chains: ReadonlyMap<ChainRef, ServedChain>,
  options: TransactionOptions,
  family: UnsignedTransaction["family"],
  admin?: AdminOptions,
): TransactionBuilder {
  assertTransactionOptions(options);
  return {
    build: async (intent: TransactionIntent, funding) => {
      if (isAdminIntent(intent)) {
        if (admin === undefined) {
          throw new BuildRefusedError(
            "unsupported-operation",
            `This adapter is not set up to administer games, so it cannot build ${intent.operation}.`,
          );
        }
        return buildAdmin(intent, { admin, chains, family, options }, funding);
      }
      if (intent.operation !== "mint-milestone") {
        throw new BuildRefusedError(
          "unsupported-operation",
          `The bitcoin-alkanes adapter builds milestone claims and game administration only, not ${intent.operation}.`,
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
      const feeRate = await node.feeRate(
        feeTargetFor(options, intent.feeSpeed),
      );
      const request: CoinRequest = {
        changeDustSats: options.changeDustSats,
        feeRate,
        fixedOutputs: [sender.value.type],
        fixedSats: options.claimOutputSats,
        kind: sender.value.type,
        opReturnScriptLength: call.length,
        utxos: await node.utxos(sender.value.address),
      };
      const selection = selectCoins(request);
      if (selection === null) {
        throw new BuildRefusedError(
          "insufficient-funds",
          `The sender's confirmed balance cannot pay for the claim${shortfallNote(request)}`,
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
          feeDetail: feeDetailFor(options, intent.feeSpeed, feeRate),
          milestone: { contract: intent.contract, id: intent.milestoneId },
          operation: "mint-milestone",
          recipient: intent.sender,
        },
      };
    },
    verifySigned: (unsigned, signed) =>
      admin !== undefined && isAdminOperation(unsigned.summary.operation)
        ? verifySignedAdmin(admin, unsigned, signed)
        : verifySignedClaim(chains, unsigned, signed),
  };
}
