import { describe, expect, it } from "vitest";

import { chainRefSchema } from "@frostbite/shared/chain";

import { signSimulated } from "../src/simulated-chain/transaction.ts";
import { fixedNow, funding, one, simulatedPorts } from "./support/chains.ts";

describe("simulated transactions", () => {
  it("builds, verifies, broadcasts, and finalizes after the finality depth", async () => {
    const { controls, intent, need } = simulatedPorts();
    const unsigned = await need("builder").build(intent, funding);
    const signed = signSimulated(unsigned);
    expect(need("builder").verifySigned(unsigned, signed)).toEqual({
      ok: true,
    });
    const outcome = await need("broadcaster").broadcast(signed);
    if (outcome.kind !== "accepted")
      throw new Error("expected an accepted broadcast");
    expect((await need("observer").observe(outcome.ref)).status).toBe(
      "pending",
    );
    controls.advance(one, 3);
    const confirmed = await need("observer").observe(outcome.ref);
    expect(confirmed).toMatchObject({ confirmations: 3, status: "confirmed" });
    expect((await need("reader").transaction(outcome.ref)).status).toBe(
      "confirmed",
    );
    expect(confirmed.observedAt).toBe(fixedNow.toISOString());
  });

  it("does not restart confirmation when the same transaction is broadcast again", async () => {
    const { controls, intent, need } = simulatedPorts();
    const unsigned = await need("builder").build(intent, funding);
    const signed = signSimulated(unsigned);
    const first = await need("broadcaster").broadcast(signed);
    if (first.kind !== "accepted")
      throw new Error("expected an accepted broadcast");
    controls.advance(one, 2);
    await need("broadcaster").broadcast(signed);
    expect(await need("observer").observe(first.ref)).toMatchObject({
      confirmations: 2,
      status: "pending",
    });
  });

  it("reports an unknown transaction as not found", async () => {
    const { need } = simulatedPorts();
    const observation = await need("observer").observe({
      chain: one,
      id: "missing",
    });
    expect(observation).toMatchObject({
      confirmations: 0,
      status: "not-found",
    });
    expect(
      (await need("reader").transaction({ chain: one, id: "missing" })).status,
    ).toBe("unknown");
  });

  async function signedTransfer() {
    const ports = simulatedPorts();
    const unsigned = await ports.need("builder").build(ports.intent, funding);
    return { ...ports, signed: signSimulated(unsigned) };
  }

  it.each(["rejected", "unavailable"] as const)(
    "a %s broadcast leaves nothing on the network, so a retry is accepted",
    async (forced) => {
      const { controls, need, signed } = await signedTransfer();
      controls.failNext(one, forced);
      const first = await need("broadcaster").broadcast(signed);
      expect(first.kind).toBe(forced);
      expect(first).not.toHaveProperty("ref");
      // Time passes before the retry; had the failed attempt reached the network, the transaction
      // would already be two blocks deep when the retry is observed.
      controls.advance(one, 2);
      const again = await need("broadcaster").broadcast(signed);
      if (again.kind !== "accepted")
        throw new Error("expected a retry to succeed");
      expect((await need("observer").observe(again.ref)).confirmations).toBe(0);
    },
  );

  it("an ambiguous broadcast reached the network: lookup by id finds it", async () => {
    const { controls, need, signed } = await signedTransfer();
    controls.failNext(one, "ambiguous");
    const first = await need("broadcaster").broadcast(signed);
    if (first.kind !== "ambiguous")
      throw new Error("expected an ambiguous outcome");
    expect((await need("observer").observe(first.ref)).status).toBe("pending");
    const again = await need("broadcaster").broadcast(signed);
    expect(again).toEqual({ kind: "accepted", ref: first.ref });
  });

  it("rejects a broadcast for an unknown chain and a fee ceiling below the network fee", async () => {
    const { intent, need } = simulatedPorts();
    const unsigned = await need("builder").build(intent, funding);
    const foreign = {
      ...signSimulated(unsigned),
      chain: chainRefSchema.parse("simnet:nine"),
    };
    expect(await need("broadcaster").broadcast(foreign)).toMatchObject({
      kind: "rejected",
    });
    await expect(
      need("builder").build(intent, {
        maxFee: {
          asset: { chain: one, id: "sim", kind: "native" },
          baseUnits: 0n,
        },
      }),
    ).rejects.toThrow(/below the network fee/u);
  });

  it("classifies verification failures", async () => {
    const { intent, need } = simulatedPorts();
    const unsigned = await need("builder").build(intent, funding);
    const signed = signSimulated(unsigned);
    const verify = need("builder").verifySigned;
    expect(verify(unsigned, { ...signed, format: "other" })).toEqual({
      ok: false,
      reason: "payload-mismatch",
    });
    expect(verify(unsigned, { ...signed, payload: unsigned.payload })).toEqual({
      ok: false,
      reason: "signature-invalid",
    });
    expect(
      verify(unsigned, { ...signed, payload: `${unsigned.payload}x.sig` }),
    ).toEqual({
      ok: false,
      reason: "payload-mismatch",
    });
    const lying = {
      ...unsigned,
      summary: {
        ...unsigned.summary,
        fee: { ...unsigned.summary.fee, baseUnits: 0n },
      },
    };
    expect(verify(lying, signSimulated(lying))).toEqual({
      ok: false,
      reason: "summary-mismatch",
    });
    const wrongShape = { ...unsigned, payload: '{"unrelated":true}' };
    expect(verify(wrongShape, signSimulated(wrongShape))).toEqual({
      ok: false,
      reason: "summary-mismatch",
    });
    const notAnObject = { ...unsigned, payload: "null" };
    expect(verify(notAnObject, signSimulated(notAnObject))).toEqual({
      ok: false,
      reason: "summary-mismatch",
    });
    const garbled = { ...unsigned, payload: "not json" };
    expect(verify(garbled, signSimulated(garbled))).toEqual({
      ok: false,
      reason: "summary-mismatch",
    });
  });
});
