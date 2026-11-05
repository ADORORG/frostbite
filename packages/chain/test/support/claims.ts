import { Psbt } from "bitcoinjs-lib";
import {
  chainFamilyIdSchema,
  chainRefSchema,
  type SignedTransaction,
  type TransactionIntent,
  type UnsignedTransaction,
} from "@frostbite/shared/chain";

import { psbtFormat } from "../../src/bitcoin-alkanes/format.ts";
import type { NodeUtxo } from "../../src/bitcoin-alkanes/node/esplora.ts";
import { fromHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import type { TransactionOptions } from "../../src/bitcoin-alkanes/options.ts";

// A chain reference and a wallet invented for tests; production values come from configuration.
export const chain = chainRefSchema.parse(
  "bip122:000000000019d6689c085ae165831e93",
);
export const family = chainFamilyIdSchema.parse("bitcoin-alkanes");
// The BIP 173 example: a P2WPKH address whose public key is the secp256k1 generator, which lets a test finalize an input
// with a syntactically valid signature without a signing library.
export const wallet = {
  chain,
  value: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
};
export const walletScript = fromHex(
  "0014751e76e8199196d454941c45d1b3a323f1433bd6",
);
const generatorPublicKey = fromHex(
  "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
);
const derSignature = fromHex("300602010102010101");

export const game = { chain, family, id: "2:5" };
export const claimIntent = {
  chain,
  contract: game,
  milestoneId: "first-frost",
  operation: "mint-milestone",
  sender: wallet,
} as const;
export const intent: TransactionIntent = claimIntent;

export const fixedNow = new Date("2026-10-16T12:00:00.000Z");
export const options: TransactionOptions = {
  changeDustSats: 294n,
  random: (length) => new Uint8Array(length),
  templateSequence: { attempts: 10, first: 1_000_000n, window: 1_000_000n },
  claimOutputSats: 546n,
  feeTargetBlocks: 3,
  feeSpeeds: {
    fast: { approxMinutes: 30, targetBlocks: 3 },
    lightning: { approxMinutes: 15, targetBlocks: 1 },
    medium: { approxMinutes: 60, targetBlocks: 6 },
    slow: { approxMinutes: 250, targetBlocks: 25 },
  },
  lifetimeMs: 600_000,
  now: () => fixedNow,
  providerId: "test-node",
};

export const utxo = (
  txid: string,
  vout: number,
  value: bigint,
  confirmed = true,
): NodeUtxo => ({
  confirmed,
  txid,
  value,
  vout,
});
export const idA = "11".repeat(32);
export const idB = "22".repeat(32);
export const idC = "33".repeat(32);

// The wallet's part: adds a signature (a syntactically valid one, not a cryptographically valid one) to every input and finalizes.
export function sign(unsigned: UnsignedTransaction): SignedTransaction {
  const psbt = Psbt.fromBase64(unsigned.payload);
  psbt.data.inputs.forEach((_input, index) => {
    psbt.updateInput(index, {
      partialSig: [{ pubkey: generatorPublicKey, signature: derSignature }],
    });
    psbt.finalizeInput(index);
  });
  return {
    chain: unsigned.chain,
    family: unsigned.family,
    format: psbtFormat,
    payload: psbt.toBase64(),
  };
}

// Signed, but with one output's value changed.
export function tamper(signed: SignedTransaction): SignedTransaction {
  const psbt = Psbt.fromBase64(signed.payload);
  const altered = new Psbt();
  psbt.txInputs.forEach((input, index) => {
    altered.addInput({
      hash: Uint8Array.from(input.hash),
      index: input.index,
      sequence: input.sequence,
      witnessUtxo: psbt.data.inputs[index]?.witnessUtxo ?? {
        script: walletScript,
        value: 0n,
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
