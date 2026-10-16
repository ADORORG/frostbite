import { Transaction } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import { createBroadcaster } from "../../src/bitcoin-alkanes/broadcaster.ts";
import {
  NodeRejectedError,
  NodeUnavailableError,
} from "../../src/bitcoin-alkanes/node/errors.ts";
import { fromHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  adminBuilder,
  adminChains,
  funding,
  intents,
  signAdmin,
} from "../support/administration.ts";

const signedPair = async () =>
  signAdmin(await adminBuilder().build(intents.define, funding));
const sending = (broadcast: (hex: string) => Promise<string>) =>
  createBroadcaster(adminChains(fakeNode({ broadcast })));

describe("sending a two-transaction step", () => {
  it("sends the commit, then the reveal, and answers with the reveal's id", async () => {
    const sent: string[] = [];
    const outcome = await sending((hex) => {
      sent.push(hex);
      return Promise.resolve("x");
    }).broadcast(await signedPair());
    const [commit, reveal] = sent.map((hex) =>
      Transaction.fromBuffer(fromHex(hex)),
    );
    expect(sent).toHaveLength(2);
    // The reveal spends the commit's first output.
    expect(Uint8Array.from(reveal?.ins[0]?.hash ?? [])).toEqual(
      Uint8Array.from(commit?.getHash() ?? []),
    );
    expect(outcome).toEqual({
      kind: "accepted",
      ref: { chain: expect.any(String), id: reveal?.getId() },
    });
  });

  it("carries on to the reveal when the node already has the commit, so a repeat is safe", async () => {
    let calls = 0;
    const outcome = await sending(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new NodeRejectedError("txn-already-in-mempool"))
        : Promise.resolve("x");
    }).broadcast(await signedPair());
    expect(calls).toBe(2);
    expect(outcome.kind).toBe("accepted");
  });

  it("stops at a rejection and does not send the reveal", async () => {
    let calls = 0;
    const outcome = await sending(() => {
      calls += 1;
      return Promise.reject(
        new NodeRejectedError("bad-txns-inputs-missingorspent"),
      );
    }).broadcast(await signedPair());
    expect(calls).toBe(1);
    expect(outcome).toMatchObject({ kind: "rejected" });
  });

  it("says the outcome is unknown when the node cannot be reached, keeping the reveal's id to follow up", async () => {
    const outcome = await sending(() =>
      Promise.reject(new NodeUnavailableError("down")),
    ).broadcast(await signedPair());
    expect(outcome).toMatchObject({
      kind: "ambiguous",
      ref: { id: expect.any(String) },
    });
  });

  it("refuses a pair that is not fully signed, or a payload that is not a pair", async () => {
    const unsigned = await adminBuilder().build(intents.define, funding);
    const broadcaster = sending(() => Promise.resolve("x"));
    const head = { chain: unsigned.chain, family: unsigned.family };
    for (const payload of [unsigned.payload, "nope"]) {
      expect(
        await broadcaster.broadcast({
          ...head,
          format: unsigned.format,
          payload,
        }),
      ).toMatchObject({ kind: "rejected" });
    }
    const plain = await adminBuilder().build(intents.pause, funding);
    expect(
      await broadcaster.broadcast({
        ...head,
        format: plain.format,
        payload: "nope",
      }),
    ).toMatchObject({ kind: "rejected" });
  });
});
