import { Psbt } from "bitcoinjs-lib";

import { callScript, type Call } from "../tx/call-script.ts";
import { selectCoins } from "../tx/coins.ts";
import type { StepFunding } from "./types.ts";
import { StepRefusedError } from "./types.ts";

// Tokens reach the call only if the runestone's default output is the output that carries it (output 1 here).
const callOutput = 1;
const replaceableSequence = 0xfffffffd;

export interface PlainStep {
  readonly fee: bigint;
  readonly transaction: Psbt;
}

// A step that is one ordinary transaction: the staff wallet's output holding the auth token (when the call needs it) and enough of
// its other outputs to pay the fee, a call, and the token and the change back to the same wallet. Output 0 receives whatever the
// call returns; a call that reverts refunds there too.
export function planPlainStep(call: Call, funding: StepFunding): PlainStep {
  const { admin, funder } = funding;
  const recipient = admin ?? funder;
  const script = callScript(call, {
    pointer: 0,
    refund: 0,
    unallocated: admin === null ? 0 : callOutput,
  });
  const firstValue = admin === null ? funding.outputDustSats : admin.value;
  const selection = selectCoins({
    changeDustSats: funding.changeDustSats,
    existingInputs: admin === null ? [] : [admin.kind],
    feeRate: funding.feeRate,
    fixedOutputs: [recipient.kind],
    fixedSats: admin === null ? funding.outputDustSats : 0n,
    kind: funder.kind,
    opReturnScriptLength: script.length,
    utxos: funder.utxos,
  });
  if (selection === null) {
    throw new StepRefusedError(
      "The wallet's confirmed balance cannot pay for the step.",
      "insufficient-funds",
    );
  }
  const psbt = new Psbt();
  psbt.setVersion(2);
  if (admin !== null) {
    psbt.addInput({
      hash: admin.txid,
      index: admin.vout,
      sequence: replaceableSequence,
      witnessUtxo: { script: admin.script, value: admin.value },
    });
  }
  for (const coin of selection.chosen) {
    psbt.addInput({
      hash: coin.txid,
      index: coin.vout,
      sequence: replaceableSequence,
      witnessUtxo: { script: funder.script, value: coin.value },
    });
  }
  psbt.addOutput({ script: recipient.script, value: firstValue });
  psbt.addOutput({ script, value: 0n });
  if (selection.change > 0n) {
    psbt.addOutput({ script: funder.script, value: selection.change });
  }
  return { fee: selection.fee, transaction: psbt };
}
