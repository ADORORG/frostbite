import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import { createClaimBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import type { ServedChain } from "../../src/bitcoin-alkanes/chains.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  chain,
  claimIntent,
  family,
  idA,
  options,
  sign,
  utxo,
} from "../support/claims.ts";
import { build, builder, funding } from "../support/verification.ts";

describe("verifying that every input is signed", () => {
  it("refuses a transaction no one has signed, or signed on only some inputs", async () => {
    const unsigned = await build();
    expect(
      builder.verifySigned(unsigned, {
        ...sign(unsigned),
        payload: unsigned.payload,
      }),
    ).toEqual({
      ok: false,
      reason: "signature-invalid",
    });
    const wide = await createClaimBuilder(
      new Map<typeof chain, ServedChain>([
        [
          chain,
          {
            network: "mainnet",
            node: fakeNode({
              feeRate: () => Promise.resolve(2),
              utxos: () =>
                Promise.resolve([
                  utxo(idA, 0, 400n),
                  utxo(idA, 1, 400n),
                  utxo(idA, 2, 400n),
                ]),
            }),
          },
        ],
      ]),
      options,
      family,
    ).build(claimIntent, funding);
    const partial = Psbt.fromBase64(sign(wide).payload);
    const half = Psbt.fromBase64(wide.payload);
    half.updateInput(0, {
      finalScriptWitness:
        partial.data.inputs[0]?.finalScriptWitness ?? new Uint8Array(),
    });
    expect(
      builder.verifySigned(wide, { ...sign(wide), payload: half.toBase64() }),
    ).toMatchObject({ reason: "signature-invalid" });
  });

  it("recognises each kind of signature a wallet may leave", async () => {
    const unsigned = await build();
    const withField = (field: object) => {
      const psbt = Psbt.fromBase64(unsigned.payload);
      psbt.updateInput(0, field);
      return { ...sign(unsigned), payload: psbt.toBase64() };
    };
    const key = new Uint8Array(32).fill(2);
    const sig = Uint8Array.of(0x30, 0x06, 2, 1, 1, 2, 1, 1, 1);
    for (const field of [
      { finalScriptSig: Uint8Array.of(0) },
      { tapKeySig: new Uint8Array(64) },
      {
        tapScriptSig: [
          { leafHash: key, pubkey: key, signature: new Uint8Array(64) },
        ],
      },
      { partialSig: [{ pubkey: new Uint8Array(33).fill(2), signature: sig }] },
    ]) {
      expect(
        builder.verifySigned(unsigned, withField(field)),
        JSON.stringify(Object.keys(field)),
      ).toEqual({ ok: true });
    }
  });
});
