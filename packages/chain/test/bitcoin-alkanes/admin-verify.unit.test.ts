import { sha256Hex } from "../../src/bitcoin-alkanes/admin/data.ts";
import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import type { UnsignedTransaction } from "@ador/shared/chain";

import {
  bundleFormat,
  decodeBundle,
  encodeBundle,
} from "../../src/bitcoin-alkanes/admin/bundle.ts";
import {
  adminBuilder,
  funding,
  intents,
  signAdmin,
  collectibleTemplateAt,
  gameCode,
  gameTemplateAt,
} from "../support/administration.ts";

const builder = adminBuilder();
const built = (intent: Parameters<typeof builder.build>[0]) =>
  builder.build(intent, funding);

describe("verifying a signed step", () => {
  it.each(Object.entries(intents))(
    "accepts %s, built and signed",
    async (_name, intent) => {
      const unsigned = await built(intent);
      expect(builder.verifySigned(unsigned, signAdmin(unsigned))).toEqual({
        ok: true,
      });
    },
  );

  it("refuses a step no one signed, or whose second transaction was not signed", async () => {
    const unsigned = await built(intents.define);
    const signed = signAdmin(unsigned);
    const bundle = decodeBundle(signed.payload);
    const original = decodeBundle(unsigned.payload);
    if (bundle === null || original === null) throw new Error("bundle");
    expect(
      builder.verifySigned(unsigned, { ...signed, payload: unsigned.payload }),
    ).toMatchObject({ reason: "signature-invalid" });
    expect(
      builder.verifySigned(unsigned, {
        ...signed,
        payload: encodeBundle({
          commit: bundle.commit,
          reveal: original.reveal,
        }),
      }),
    ).toMatchObject({ reason: "signature-invalid" });
  });

  it("refuses a different format, chain, or payload that is not what was built", async () => {
    const unsigned = await built(intents.define);
    const signed = signAdmin(unsigned);
    for (const other of [
      { ...signed, format: "other/1" },
      { ...signed, payload: "not json" },
      { ...signed, payload: JSON.stringify({ commit: "x", reveal: "y" }) },
      { ...signed, payload: JSON.stringify({ commit: "x" }) },
      { ...signed, payload: "null" },
    ]) {
      expect(builder.verifySigned(unsigned, other)).toMatchObject({
        reason: "payload-mismatch",
      });
    }
    const single = await built(intents.pause);
    expect(
      builder.verifySigned(single, { ...signAdmin(single), payload: "nope" }),
    ).toMatchObject({ reason: "payload-mismatch" });
    expect(
      builder.verifySigned(
        { ...unsigned, format: "other/1" },
        { ...signed, format: "other/1" },
      ),
    ).toMatchObject({ reason: "payload-mismatch" });
    // One transaction where two were built.
    expect(
      builder.verifySigned(unsigned, {
        ...signAdmin(single),
        format: bundleFormat,
      }),
    ).toMatchObject({ reason: "payload-mismatch" });
  });

  it("refuses a pair whose reveal was changed, even by one byte of its data", async () => {
    const unsigned = await built(intents.define);
    const signed = signAdmin(unsigned);
    const bundle = decodeBundle(signed.payload);
    if (bundle === null) throw new Error("bundle");
    const witness = bundle.reveal.data.inputs[0]?.finalScriptWitness;
    if (witness === undefined) throw new Error("witness");
    const altered = Uint8Array.from(witness);
    // Inside the script, which holds the drawing.
    altered[100] = (altered[100] ?? 0) ^ 1;
    const input = bundle.reveal.data.inputs[0];
    if (input === undefined) throw new Error("input");
    input.finalScriptWitness = altered;
    expect(
      builder.verifySigned(unsigned, {
        ...signed,
        payload: encodeBundle(bundle),
      }),
    ).toMatchObject({ reason: "payload-mismatch" });
  });

  it("refuses a summary that says something other than the transactions do", async () => {
    const lies = (
      unsigned: UnsignedTransaction,
      change: Partial<UnsignedTransaction["summary"]>,
    ) => ({ ...unsigned, summary: { ...unsigned.summary, ...change } });
    const define = await built(intents.define);
    const pause = await built(intents.pause);
    const publish = await built(intents.publish);
    const deploy = await built(intents.deploy);
    const plain = await built(intents.defineNoDrawing);
    const cases: UnsignedTransaction[] = [
      lies(define, { claimLimit: 3 }),
      lies(define, { drawing: { bytes: 1, sha256: "0".repeat(64) } }),
      lies(define, { drawing: undefined }),
      lies(define, {
        milestone: {
          contract:
            define.summary.milestone?.contract ?? intents.define.contract,
          id: "other-one",
        },
      }),
      lies(define, { fee: { ...define.summary.fee, baseUnits: 1n } }),
      lies(pause, { paused: false }),
      lies(pause, { contract: undefined }),
      lies(plain, { drawing: { bytes: 1, sha256: "0".repeat(64) } }),
      lies(publish, {
        template: {
          codeHash: "0".repeat(64),
          id: "game-rewards",
          version: "1.0.0",
        },
      }),
      lies(publish, { template: undefined }),
      lies(publish, {
        template: {
          at: { ...gameTemplateAt, id: "4:2001" },
          codeHash: sha256Hex(gameCode),
          id: "game-rewards",
          version: "1.0.0",
        },
      }),
      lies(deploy, {
        collectibleAt: { ...collectibleTemplateAt, id: "4:1001" },
      }),
      lies(deploy, { collectibleAt: undefined }),
      lies(deploy, { maxDrawingBytes: 1024 }),
      lies(deploy, { maxDrawingBytes: undefined }),
      lies(deploy, {
        template: {
          codeHash: "0".repeat(64),
          id: "game-rewards",
          version: "1.0.0",
        },
      }),
      lies(deploy, { operation: "mint-milestone" }),
      lies(deploy, { operation: "transfer" }),
    ];
    for (const [index, unsigned] of cases.entries()) {
      expect(
        builder.verifySigned(unsigned, signAdmin(unsigned)),
        `case ${index}`,
      ).toEqual({ ok: false, reason: "summary-mismatch" });
    }
  });

  it("refuses a step whose reveal does not spend its own commit", async () => {
    const unsigned = await built(intents.define);
    const bundle = decodeBundle(unsigned.payload);
    if (bundle === null) throw new Error("bundle");
    const other = Psbt.fromBase64(bundle.commit.toBase64());
    other.setLocktime(1);
    const swapped = {
      ...unsigned,
      payload: encodeBundle({ commit: other, reveal: bundle.reveal }),
    };
    expect(builder.verifySigned(swapped, signAdmin(swapped))).toMatchObject({
      reason: "summary-mismatch",
    });
  });
});
