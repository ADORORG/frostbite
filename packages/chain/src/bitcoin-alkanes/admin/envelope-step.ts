import { Psbt, Transaction } from "bitcoinjs-lib";

import { fromHex } from "../node/hex.ts";
import { callScript, type Call } from "../tx/call-script.ts";
import { selectCoins } from "../tx/coins.ts";
import { feeFor } from "../tx/fees.ts";
import { createEnvelope, tapscriptLeafVersion } from "./envelope.ts";
import type { OneTimeKey } from "./one-time-key.ts";
import { StepRefusedError, type StepFunding } from "./types.ts";

const callOutput = 1;
const replaceableSequence = 0xfffffffd;
// A BIP 340 signature with the default sighash is 64 bytes.
const schnorrSignatureBytes = 64;
// A DER ECDSA signature is at most 72 bytes with its sighash byte, and a compressed key is 33.
const ecdsaSignatureBytes = 72;
const compressedKeyBytes = 33;

export interface EnvelopeStep {
  readonly commit: Psbt;
  readonly commitFee: bigint;
  // What is paid to the commit address: the reveal's fee, plus any top-up so its first output is above the dust limit.
  readonly commitSats: bigint;
  readonly reveal: Psbt;
  readonly revealFee: bigint;
}

function reversed(txid: string): Uint8Array {
  return Uint8Array.from(fromHex(txid)).reverse();
}

// The reveal's size as it will be once signed, from a copy with placeholder signatures.
function revealVirtualSize(
  funding: StepFunding,
  script: Uint8Array,
  controlBlock: Uint8Array,
  callOutputScript: Uint8Array,
  recipientScript: Uint8Array,
): number {
  const tx = new Transaction();
  tx.version = 2;
  tx.setWitness(tx.addInput(new Uint8Array(32), 0, replaceableSequence), [
    new Uint8Array(schnorrSignatureBytes),
    script,
    controlBlock,
  ]);
  if (funding.admin !== null) {
    tx.setWitness(
      tx.addInput(new Uint8Array(32).fill(1), 0, replaceableSequence),
      funding.admin.kind === "p2tr"
        ? [new Uint8Array(schnorrSignatureBytes)]
        : [
            new Uint8Array(ecdsaSignatureBytes),
            new Uint8Array(compressedKeyBytes),
          ],
    );
  }
  tx.addOutput(recipientScript, 0n);
  tx.addOutput(callOutputScript, 0n);
  return tx.virtualSize();
}

// A step whose call carries data in the witness (a template's code, a milestone's drawing). It is two transactions: a commit that
// pays a small amount to a taproot address derived from the data, and a reveal that spends it and so shows the data. Both are built
// together: a SegWit transaction's id does not depend on its signatures, so the reveal can name the commit's output now. The
// reveal's input is signed here with a one-time key, which is then destroyed; the staff's wallet signs the commit, and the reveal's
// other input (the auth token), later. Nothing is kept between the two.
export function planEnvelopeStep(
  call: Call,
  data: Uint8Array,
  funding: StepFunding,
  key: OneTimeKey,
): EnvelopeStep {
  try {
    const { admin, funder } = funding;
    const recipient = admin ?? funder;
    const envelope = createEnvelope(key.xOnly, data);
    const callOutputScript = callScript(call, {
      pointer: 0,
      refund: 0,
      unallocated: admin === null ? 0 : callOutput,
    });
    const revealFee = feeFor(
      revealVirtualSize(
        funding,
        envelope.script,
        envelope.controlBlock,
        callOutputScript,
        recipient.script,
      ),
      funding.feeRate,
    );
    // The reveal's first output gets the commit and the token's output, less the fee; it must clear the dust limit.
    const adminValue = admin?.value ?? 0n;
    const top =
      funding.outputDustSats > adminValue
        ? funding.outputDustSats - adminValue
        : 0n;
    const commitSats = revealFee + top;

    const selection = selectCoins({
      changeDustSats: funding.changeDustSats,
      feeRate: funding.feeRate,
      fixedOutputs: ["p2tr"],
      fixedSats: commitSats,
      kind: funder.kind,
      opReturnScriptLength: null,
      utxos: funder.utxos,
    });
    if (selection === null) {
      throw new StepRefusedError(
        "The wallet's confirmed balance cannot pay for the step.",
      );
    }

    // The commit, as a plain transaction (for its id) and as the PSBT the staff's wallet signs.
    const commitTx = new Transaction();
    commitTx.version = 2;
    const commit = new Psbt();
    commit.setVersion(2);
    for (const coin of selection.chosen) {
      commitTx.addInput(reversed(coin.txid), coin.vout, replaceableSequence);
      commit.addInput({
        hash: coin.txid,
        index: coin.vout,
        sequence: replaceableSequence,
        witnessUtxo: { script: funder.script, value: coin.value },
      });
    }
    commitTx.addOutput(envelope.output, commitSats);
    commit.addOutput({ script: envelope.output, value: commitSats });
    if (selection.change > 0n) {
      commitTx.addOutput(funder.script, selection.change);
      commit.addOutput({ script: funder.script, value: selection.change });
    }

    const reveal = new Psbt();
    reveal.setVersion(2);
    reveal.addInput({
      hash: commitTx.getId(),
      index: 0,
      sequence: replaceableSequence,
      tapLeafScript: [
        {
          controlBlock: envelope.controlBlock,
          leafVersion: tapscriptLeafVersion,
          script: envelope.script,
        },
      ],
      witnessUtxo: { script: envelope.output, value: commitSats },
    });
    if (admin !== null) {
      reveal.addInput({
        hash: admin.txid,
        index: admin.vout,
        sequence: replaceableSequence,
        witnessUtxo: { script: admin.script, value: admin.value },
      });
    }
    reveal.addOutput({
      script: recipient.script,
      value: commitSats + adminValue - revealFee,
    });
    reveal.addOutput({ script: callOutputScript, value: 0n });
    reveal.signInput(0, key);
    reveal.finalizeInput(0);

    return { commit, commitFee: selection.fee, commitSats, reveal, revealFee };
  } finally {
    key.destroy();
  }
}
