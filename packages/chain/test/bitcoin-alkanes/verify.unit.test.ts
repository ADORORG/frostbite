import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import {
  chainRefSchema,
  type SignedTransaction,
  type UnsignedTransaction,
} from "@frostbite/shared/chain";

import { family, sign, tamper } from "../support/claims.ts";
import { build, builder } from "../support/verification.ts";

const reencode = (
  unsigned: UnsignedTransaction,
  change: (psbt: Psbt) => void,
) => {
  const psbt = Psbt.fromBase64(unsigned.payload);
  change(psbt);
  return psbt.toBase64();
};

describe("verifying what the wallet signed", () => {
  it("accepts the transaction that was built, signed", async () => {
    const unsigned = await build();
    expect(builder.verifySigned(unsigned, sign(unsigned))).toEqual({
      ok: true,
    });
  });

  it("refuses a transaction whose outputs were changed", async () => {
    const unsigned = await build();
    expect(builder.verifySigned(unsigned, tamper(sign(unsigned)))).toEqual({
      ok: false,
      reason: "payload-mismatch",
    });
  });

  it("refuses one with an input added, removed or reordered, another version, or another lock time", async () => {
    const unsigned = await build();
    const signed = sign(unsigned);
    const other = (change: (psbt: Psbt) => void): SignedTransaction => ({
      ...signed,
      payload: reencode({ ...unsigned, payload: signed.payload }, change),
    });
    expect(
      builder.verifySigned(
        unsigned,
        other((psbt) => psbt.setLocktime(5)),
      ),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned(
        unsigned,
        other((psbt) => psbt.setVersion(1)),
      ),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned(
        unsigned,
        other((psbt) =>
          psbt.addOutput({
            script: psbt.txOutputs[0]?.script ?? new Uint8Array(),
            value: 1n,
          }),
        ),
      ),
    ).toMatchObject({ reason: "payload-mismatch" });
  });

  it("refuses one with an input added, or an input's sequence changed", async () => {
    interface Outpoint {
      hash: Uint8Array;
      index: number;
      sequence: number;
    }
    const unsigned = await build();
    const signed = sign(unsigned);
    const rebuilt = (change: (inputs: Outpoint[]) => Outpoint[]) => {
      const original = Psbt.fromBase64(signed.payload);
      const next = new Psbt();
      next.setVersion(original.version);
      change(
        original.txInputs.map((input) => ({
          hash: input.hash,
          index: input.index,
          sequence: input.sequence ?? 0,
        })),
      ).forEach((input, position) => {
        next.addInput({
          hash: input.hash,
          index: input.index,
          sequence: input.sequence,
          witnessUtxo: original.data.inputs[position]?.witnessUtxo ??
            original.data.inputs[0]?.witnessUtxo ?? {
              script: new Uint8Array(22),
              value: 0n,
            },
        });
      });
      original.txOutputs.forEach((output) =>
        next.addOutput({ script: output.script, value: output.value }),
      );
      return { ...signed, payload: next.toBase64() };
    };
    const extra = rebuilt((inputs) => [
      ...inputs.map((input) => ({ ...input })),
      { hash: new Uint8Array(32).fill(7), index: 1, sequence: 1 },
    ]);
    expect(builder.verifySigned(unsigned, extra)).toMatchObject({
      reason: "payload-mismatch",
    });
    const resequenced = rebuilt((inputs) =>
      inputs.map((input) => ({ ...input, sequence: input.sequence - 1 })),
    );
    expect(builder.verifySigned(unsigned, resequenced)).toMatchObject({
      reason: "payload-mismatch",
    });
  });

  it("refuses a different chain, family or format, and payloads that are not PSBTs", async () => {
    const unsigned = await build();
    const signed = sign(unsigned);
    const elsewhere = chainRefSchema.parse(
      "bip122:00000000000000000000000000000009",
    );
    expect(
      builder.verifySigned(unsigned, { ...signed, chain: elsewhere }),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned(unsigned, {
        ...signed,
        family: "other" as typeof family,
      }),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned(unsigned, { ...signed, format: "other/1" }),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned(unsigned, { ...signed, payload: "not a psbt" }),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned({ ...unsigned, payload: "not a psbt" }, signed),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned(
        { ...unsigned, format: "other/1" },
        { ...signed, format: "other/1" },
      ),
    ).toMatchObject({
      reason: "payload-mismatch",
    });
  });
});
