import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import { psbtFormat } from "../../src/bitcoin-alkanes/format.ts";
import {
  walletRequests,
  withWalletSignatures,
} from "../../src/bitcoin-alkanes/wallet-signing.ts";
import { adminBuilder, funding, intents } from "../support/administration.ts";
import { signRemaining } from "../support/admin.ts";

const builder = adminBuilder();
const built = (intent: Parameters<typeof builder.build>[0]) =>
  builder.build(intent, funding);

// What a wallet does with a request: signs the inputs it was asked for.
const walletAnswers = (
  requests: NonNullable<ReturnType<typeof walletRequests>>,
) =>
  requests.map(({ psbt }) => signRemaining(Psbt.fromBase64(psbt)).toBase64());

describe("what a wallet is asked to sign", () => {
  it.each(Object.entries(intents))(
    "asks for the unsigned inputs of %s and no others, and the answers make a transaction the platform accepts",
    async (_name, intent) => {
      const unsigned = await built(intent);
      const requests = walletRequests(unsigned.format, unsigned.payload);
      if (requests === null) throw new Error("not a format of this family");
      expect(requests.length).toBeGreaterThan(0);
      for (const { inputs, psbt } of requests) {
        const parsed = Psbt.fromBase64(psbt);
        expect(inputs.length).toBeGreaterThan(0);
        expect(inputs).toEqual(
          parsed.data.inputs.flatMap((input, index) =>
            input.finalScriptWitness === undefined &&
            input.tapKeySig === undefined
              ? [index]
              : [],
          ),
        );
      }
      const payload = withWalletSignatures(
        unsigned.format,
        unsigned.payload,
        walletAnswers(requests),
      );
      if (payload === null) throw new Error("answers did not fit");
      expect(
        builder.verifySigned(unsigned, {
          chain: unsigned.chain,
          family: unsigned.family,
          format: unsigned.format,
          payload,
        }),
      ).toEqual({ ok: true });
    },
  );

  it("never asks about the reveal's own input, which the platform signed with a key made for the step", async () => {
    const unsigned = await built(intents.define);
    const requests = walletRequests(unsigned.format, unsigned.payload) ?? [];
    for (const { inputs, psbt } of requests) {
      const first = Psbt.fromBase64(psbt).data.inputs[0];
      if (first?.finalScriptWitness !== undefined)
        expect(inputs).not.toContain(0);
    }
  });

  it("asks for nothing, and takes no answers, for a transaction already signed", async () => {
    const unsigned = await built(intents.pause);
    const requests = walletRequests(unsigned.format, unsigned.payload);
    if (requests === null) throw new Error("not a format of this family");
    const signed = withWalletSignatures(
      unsigned.format,
      unsigned.payload,
      walletAnswers(requests),
    );
    if (signed === null) throw new Error("not signed");
    expect(walletRequests(unsigned.format, signed)).toEqual([]);
    expect(withWalletSignatures(unsigned.format, signed, [])).toBe(signed);
    expect(withWalletSignatures(unsigned.format, signed, ["x"])).toBeNull();
  });

  it("refuses a format it does not build, a payload that is not one, and answers that do not fit", async () => {
    const unsigned = await built(intents.define);
    const requests = walletRequests(unsigned.format, unsigned.payload) ?? [];
    expect(walletRequests("other/1", unsigned.payload)).toBeNull();
    expect(withWalletSignatures("other/1", unsigned.payload, [])).toBeNull();
    expect(walletRequests(unsigned.format, "nope")).toBeNull();
    expect(walletRequests(psbtFormat, "nope")).toBeNull();
    expect(withWalletSignatures(unsigned.format, "nope", [])).toBeNull();
    expect(withWalletSignatures(psbtFormat, "nope", ["x"])).toBeNull();
    const answers = walletAnswers(requests);
    expect(
      withWalletSignatures(unsigned.format, unsigned.payload, answers.slice(1)),
    ).toBeNull();
    expect(
      withWalletSignatures(unsigned.format, unsigned.payload, [
        ...answers,
        "extra",
      ]),
    ).toBeNull();
    expect(
      withWalletSignatures(
        unsigned.format,
        unsigned.payload,
        answers.map(() => "not a psbt"),
      ),
    ).toBeNull();
  });
});
