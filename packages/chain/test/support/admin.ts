import { Psbt } from "bitcoinjs-lib";

import { newOneTimeKey } from "../../src/bitcoin-alkanes/admin/one-time-key.ts";
import type {
  StepFunding,
  TokenOutput,
} from "../../src/bitcoin-alkanes/admin/types.ts";
import { idA, utxo, walletScript } from "./claims.ts";

const generatorPublicKey = Uint8Array.from(
  Buffer.from(
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "hex",
  ),
);
const derSignature = Uint8Array.from([0x30, 0x06, 2, 1, 1, 2, 1, 1, 1]);

// The same key every time, so a step comes out byte for byte the same.
// (Also the signature's auxiliary randomness, which is why the same step is byte for byte the same.)
export const fixedKey = () => newOneTimeKey(() => new Uint8Array(32).fill(7));

// The output a game's auth token sits on, in a fake transaction.
export const tokenOutput: TokenOutput = {
  kind: "p2wpkh",
  script: walletScript,
  txid: "aa".repeat(32),
  value: 1_000n,
  vout: 0,
};

export function fundingFor(
  admin: TokenOutput | null,
  value = 100_000n,
): StepFunding {
  return {
    admin,
    changeDustSats: 294n,
    feeRate: 2,
    funder: {
      kind: "p2wpkh",
      script: walletScript,
      utxos: [utxo(idA, 0, value)],
    },
    outputDustSats: 546n,
  };
}

// The staff wallet's part: signs (with a syntactically valid signature, not a cryptographically valid one) every input not yet
// signed, and finalizes it. The reveal's own input arrives already finalized.
export function signRemaining(psbt: Psbt): Psbt {
  psbt.data.inputs.forEach((input, index) => {
    if (input.finalScriptWitness !== undefined) return;
    psbt.updateInput(index, {
      partialSig: [{ pubkey: generatorPublicKey, signature: derSignature }],
    });
    psbt.finalizeInput(index);
  });
  return psbt;
}
