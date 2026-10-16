import { describe, expect, it } from "vitest";
import { Psbt } from "bitcoinjs-lib";
import { chainRefSchema, type FundingPolicy } from "@ador/shared/chain";

import { createClaimBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import { createBroadcaster } from "../../src/bitcoin-alkanes/broadcaster.ts";
import { createObserver } from "../../src/bitcoin-alkanes/observer.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import {
  NodeRejectedError,
  NodeUnavailableError,
} from "../../src/bitcoin-alkanes/node/errors.ts";
import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  chain,
  claimIntent,
  family,
  fixedNow,
  idA,
  options,
  sign,
  utxo,
} from "../support/claims.ts";

const funding: FundingPolicy = {
  maxFee: { asset: nativeAsset(chain), baseUnits: 10_000n },
};
const served = (node: AlkanesNode) =>
  new Map<typeof chain, ServedChain>([[chain, { network: "mainnet", node }]]);
const wallet = fakeNode({
  feeRate: () => Promise.resolve(2),
  utxos: () => Promise.resolve([utxo(idA, 0, 100_000n)]),
});
const signedClaim = async () =>
  sign(
    await createClaimBuilder(served(wallet), options, family).build(
      claimIntent,
      funding,
    ),
  );

describe("sending a signed claim", () => {
  it("sends the transaction and answers with its id, the same id every time", async () => {
    const sent: string[] = [];
    const broadcaster = createBroadcaster(
      served(
        fakeNode({
          broadcast: (hex) => {
            sent.push(hex);
            return Promise.resolve("x");
          },
        }),
      ),
    );
    const signed = await signedClaim();
    const first = await broadcaster.broadcast(signed);
    const second = await broadcaster.broadcast(signed);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ kind: "accepted", ref: { chain } });
    expect(first.kind === "accepted" && first.ref.id).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(sent).toHaveLength(2);
    expect(sent[0]).toBe(sent[1]);
    expect(sent[0]).toMatch(/^02000000/u);
  });

  it("finalizes inputs the wallet signed but left open", async () => {
    const signed = await signedClaim();
    const open = Psbt.fromBase64(signed.payload);
    const psbt = Psbt.fromBase64(
      (
        await createClaimBuilder(served(wallet), options, family).build(
          claimIntent,
          funding,
        )
      ).payload,
    );
    psbt.updateInput(0, {
      partialSig: [
        {
          pubkey: Uint8Array.from(
            Buffer.from(
              "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
              "hex",
            ),
          ),
          signature: Uint8Array.from([0x30, 6, 2, 1, 1, 2, 1, 1, 1]),
        },
      ],
    });
    expect(open.data.inputs[0]?.finalScriptWitness).toBeDefined();
    const broadcaster = createBroadcaster(
      served(fakeNode({ broadcast: () => Promise.resolve("x") })),
    );
    expect(
      await broadcaster.broadcast({ ...signed, payload: psbt.toBase64() }),
    ).toMatchObject({ kind: "accepted" });
  });

  it("refuses what is not a fully signed PSBT, without calling the node", async () => {
    const broadcaster = createBroadcaster(served(fakeNode()));
    const signed = await signedClaim();
    const unsigned = await createClaimBuilder(
      served(wallet),
      options,
      family,
    ).build(claimIntent, funding);
    expect(
      await broadcaster.broadcast({ ...signed, payload: unsigned.payload }),
    ).toMatchObject({
      kind: "rejected",
      reason: expect.stringContaining("fully signed"),
    });
    expect(
      await broadcaster.broadcast({ ...signed, payload: "garbage" }),
    ).toMatchObject({ kind: "rejected" });
    expect(
      await broadcaster.broadcast({ ...signed, format: "other/1" }),
    ).toMatchObject({
      kind: "rejected",
      reason: expect.stringContaining("format"),
    });
  });

  it("reports a refusal with the node's reason, and a repeat as accepted", async () => {
    const signed = await signedClaim();
    const refusing = (message: string) =>
      createBroadcaster(
        served(
          fakeNode({
            broadcast: () => Promise.reject(new NodeRejectedError(message)),
          }),
        ),
      );
    expect(
      await refusing("bad-txns-inputs-missingorspent").broadcast(signed),
    ).toEqual({ kind: "rejected", reason: "bad-txns-inputs-missingorspent" });
    for (const message of [
      'sendrawtransaction RPC error: {"code":-27,"message":"Transaction already in block chain"}',
      "txn-already-in-mempool",
      "Transaction already in the mempool",
      "txn-already-known",
    ]) {
      expect(await refusing(message).broadcast(signed), message).toMatchObject({
        kind: "accepted",
      });
    }
  });

  it("calls a send whose outcome is unknown ambiguous, with the id to follow up", async () => {
    const signed = await signedClaim();
    const broadcaster = createBroadcaster(
      served(
        fakeNode({
          broadcast: () => Promise.reject(new NodeUnavailableError("timeout")),
        }),
      ),
    );
    const outcome = await broadcaster.broadcast(signed);
    expect(outcome).toMatchObject({ kind: "ambiguous", ref: { chain } });
  });

  it("lets an unexpected failure through rather than hiding it", async () => {
    const broadcaster = createBroadcaster(
      served(
        fakeNode({ broadcast: () => Promise.reject(new TypeError("bug")) }),
      ),
    );
    await expect(broadcaster.broadcast(await signedClaim())).rejects.toThrow(
      "bug",
    );
  });
});

describe("watching a claim", () => {
  const ref = { chain, id: "aa".repeat(32) };
  const confirmedAt = (height: number, outputs = 3) => ({
    blockHash: "bb".repeat(32),
    blockHeight: height,
    confirmed: true,
    outputs,
  });
  const observer = (node: Partial<AlkanesNode>) =>
    createObserver(served(fakeNode(node)), options);
  const tipAt = (height: number) => () =>
    Promise.resolve({ hash: "cc".repeat(32), height });

  it("says not found for a transaction the node has never heard of", async () => {
    const observed = await observer({
      transaction: () => Promise.resolve(null),
    }).observe(ref);
    expect(observed).toEqual({
      confirmations: 0,
      observedAt: fixedNow.toISOString(),
      provider: "test-node",
      ref,
      status: "not-found",
    });
  });

  it("says pending for one still in the mempool", async () => {
    const waiting = {
      blockHash: null,
      blockHeight: null,
      confirmed: false,
      outputs: 3,
    };
    expect(
      await observer({ transaction: () => Promise.resolve(waiting) }).observe(
        ref,
      ),
    ).toMatchObject({ confirmations: 0, status: "pending" });
  });

  it("says pending, with its confirmations, for one in a block the indexer has not reached", async () => {
    const observed = await observer({
      indexedHeight: () => Promise.resolve(99),
      tip: tipAt(102),
      transaction: () => Promise.resolve(confirmedAt(100)),
    }).observe(ref);
    expect(observed).toMatchObject({
      block: { chain, hash: "bb".repeat(32), height: 100 },
      confirmations: 3,
      status: "pending",
    });
  });

  it("says confirmed when the call ran, reading the trace at the output after the last one", async () => {
    const asked: { vout?: number; id?: string } = {};
    const observed = await observer({
      indexedHeight: () => Promise.resolve(100),
      tip: tipAt(100),
      trace: (id, vout) => {
        asked.id = id;
        asked.vout = vout;
        return Promise.resolve("success");
      },
      transaction: () => Promise.resolve(confirmedAt(100, 3)),
    }).observe(ref);
    expect(observed).toMatchObject({ confirmations: 1, status: "confirmed" });
    expect(asked).toEqual({ id: ref.id, vout: 4 });
  });

  it("says reverted when the call failed, or left no trace though the indexer has the block", async () => {
    const node = (outcome: "failure" | "none") => ({
      indexedHeight: () => Promise.resolve(100),
      tip: tipAt(100),
      trace: () => Promise.resolve(outcome),
      transaction: () => Promise.resolve(confirmedAt(100, 2)),
    });
    expect(await observer(node("failure")).observe(ref)).toMatchObject({
      status: "reverted",
    });
    expect(await observer(node("none")).observe(ref)).toMatchObject({
      status: "reverted",
    });
  });

  it("never reports fewer than one confirmation for a transaction in a block", async () => {
    const behind = await observer({
      indexedHeight: () => Promise.resolve(100),
      tip: tipAt(99),
      trace: () => Promise.resolve("success"),
      transaction: () => Promise.resolve(confirmedAt(100)),
    }).observe(ref);
    expect(behind.confirmations).toBe(1);
  });

  it("refuses a chain it does not serve", async () => {
    const elsewhere = chainRefSchema.parse(
      "bip122:00000000000000000000000000000009",
    );
    await expect(
      observer({}).observe({ chain: elsewhere, id: ref.id }),
    ).rejects.toThrow("not served");
  });
});
