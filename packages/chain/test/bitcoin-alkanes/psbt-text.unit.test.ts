import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import { encodeBundle } from "../../src/bitcoin-alkanes/admin/bundle.ts";
import { defineMilestoneCall } from "../../src/bitcoin-alkanes/admin/calls.ts";
import { planEnvelopeStep } from "../../src/bitcoin-alkanes/admin/envelope-step.ts";
import { psbtToBase64 } from "../../src/bitcoin-alkanes/psbt-text.ts";
import {
  walletRequests,
  withWalletSignatures,
} from "../../src/bitcoin-alkanes/wallet-signing.ts";
import {
  fixedKey,
  fundingFor,
  signRemaining,
  tokenOutput,
} from "../support/admin.ts";

// A template's reveal is over 100 KB; this one is 300 KB.
const bigStep = () =>
  planEnvelopeStep(
    defineMilestoneCall({ block: 2n, tx: 1n }, 77n, 3n),
    Uint8Array.from({ length: 300_000 }, (_, i) => (i * 2_654_435_761) % 251),
    fundingFor(tokenOutput, 1_000_000_000n),
    fixedKey(),
  );

describe("a PSBT as text, however large", () => {
  it("is large enough here that passing every byte to one call overflows the stack, as the library's browser version does", () => {
    const bytes = bigStep().reveal.toBuffer();
    expect(bytes.length).toBeGreaterThan(200_000);
    expect(() => String.fromCharCode(...bytes)).toThrow(RangeError);
  });

  it("is the same base64 the library writes, and reads back to the same PSBT", () => {
    const { reveal } = bigStep();
    const text = psbtToBase64(reveal);
    expect(text).toBe(Buffer.from(reveal.toBuffer()).toString("base64"));
    expect(Psbt.fromBase64(text).toBuffer()).toEqual(reveal.toBuffer());
  });

  it("asks the wallet to sign a template step and puts its answer back, without the stack overflowing", () => {
    const step = bigStep();
    const payload = encodeBundle(step);
    const requests = walletRequests("bitcoin-psbt-bundle", payload);
    expect(requests).toHaveLength(2);
    const answers = (requests ?? []).map(({ psbt }) =>
      psbtToBase64(signRemaining(Psbt.fromBase64(psbt))),
    );
    const signed = withWalletSignatures(
      "bitcoin-psbt-bundle",
      payload,
      answers,
    );
    expect(signed).not.toBeNull();
    expect(JSON.parse(signed ?? "{}")).toHaveProperty("reveal");
  });
});
