import { Psbt } from "bitcoinjs-lib";
import type {
  SignedTransaction,
  UnsignedTransaction,
} from "@ador/shared/chain";

import type { AlkanesNode } from "@ador/chain/bitcoin-alkanes";

// The BIP 173 example address: a P2WPKH wallet whose public key is the secp256k1 generator, so a test can finalize an input with
// a syntactically valid signature without a signing library. Nothing here is a real signature.
export const walletAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const walletScript = Buffer.from(
  "0014751e76e8199196d454941c45d1b3a323f1433bd6",
  "hex",
);
const publicKey = Buffer.from(
  "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  "hex",
);
const signature = Buffer.from("300602010102010101", "hex");

export function signAll(unsigned: UnsignedTransaction): SignedTransaction {
  const psbt = Psbt.fromBase64(unsigned.payload);
  psbt.data.inputs.forEach((_input, index) => {
    psbt.updateInput(index, { partialSig: [{ pubkey: publicKey, signature }] });
    psbt.finalizeInput(index);
  });
  return {
    chain: unsigned.chain,
    family: unsigned.family,
    format: unsigned.format,
    payload: psbt.toBase64(),
  };
}

// The same signed transaction with the amount paid to the claimant changed.
export function raiseFirstOutput(signed: SignedTransaction): SignedTransaction {
  const psbt = Psbt.fromBase64(signed.payload);
  const altered = new Psbt();
  psbt.txInputs.forEach((input, index) => {
    altered.addInput({
      hash: Uint8Array.from(input.hash),
      index: input.index,
      sequence: input.sequence,
      witnessUtxo: {
        script: walletScript,
        value: psbt.data.inputs[index]?.witnessUtxo?.value ?? 0n,
      },
    });
  });
  psbt.txOutputs.forEach((output, index) =>
    altered.addOutput({
      script: output.script,
      value: index === 0 ? output.value + 1n : output.value,
    }),
  );
  return { ...signed, payload: altered.toBase64() };
}

// A node on which the wallet has one confirmed output, nothing has been claimed, and a sent transaction is mined at once and
// indexed with a successful call.
export function claimNode(): AlkanesNode {
  let sent = false;
  return {
    broadcast: () => {
      sent = true;
      return Promise.resolve("00".repeat(32));
    },
    bytecode: () => Promise.resolve(null),
    feeRate: () => Promise.resolve(2),
    indexedHeight: () => Promise.resolve(100),
    tip: () => Promise.resolve({ hash: "cc".repeat(32), height: 100 }),
    trace: () => Promise.resolve("success"),
    transaction: () =>
      Promise.resolve(
        sent
          ? {
              blockHash: "bb".repeat(32),
              blockHeight: 100,
              confirmed: true,
              outputs: 3,
            }
          : null,
      ),
    utxos: () =>
      Promise.resolve([
        { confirmed: true, txid: "11".repeat(32), value: 100_000n, vout: 0 },
      ]),
    view: (_target, opcode) =>
      Promise.resolve(
        opcode === 100n
          ? { data: new Uint8Array(16), fuelUsed: 0n, ok: true }
          : { error: "unexpected end-of-file", ok: false },
      ),
  };
}
