import { Psbt } from "bitcoinjs-lib";

import type { NodeUtxo } from "../node/esplora.ts";

// Opts in to replacement (BIP 125), so a stuck claim can be bumped.
const replaceableSequence = 0xfffffffd;

export interface ClaimPlan {
  readonly changeSats: bigint;
  readonly claimOutputSats: bigint;
  // The `OP_RETURN` output that makes the call (`claimScript`).
  readonly claimScript: Uint8Array;
  readonly inputs: readonly NodeUtxo[];
  // The platform's fee: paid to its own script, as the third output (after the claimant and the call), when there is one.
  readonly platformFee?: { readonly sats: bigint; readonly script: Uint8Array };
  // The sender's own output script: it receives the collectible (output 0) and any change, and it owns every input.
  readonly senderScript: Uint8Array;
}

// Outputs, in this order: the claimant (output 0, where the contract reads who is claiming), the call, the platform's fee when there is
// one, then change when there is any.
export function buildClaimPsbt(plan: ClaimPlan): Psbt {
  const psbt = new Psbt();
  psbt.setVersion(2);
  for (const input of plan.inputs) {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      sequence: replaceableSequence,
      witnessUtxo: { script: plan.senderScript, value: input.value },
    });
  }
  psbt.addOutput({ script: plan.senderScript, value: plan.claimOutputSats });
  psbt.addOutput({ script: plan.claimScript, value: 0n });
  if (plan.platformFee !== undefined) {
    psbt.addOutput({
      script: plan.platformFee.script,
      value: plan.platformFee.sats,
    });
  }
  if (plan.changeSats > 0n) {
    psbt.addOutput({ script: plan.senderScript, value: plan.changeSats });
  }
  return psbt;
}
