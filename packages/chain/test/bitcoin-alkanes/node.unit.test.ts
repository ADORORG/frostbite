import { describe, expect, it } from "vitest";
import type { JsonValue } from "@ador/shared/chain";

import { NodeRejectedError } from "../../src/bitcoin-alkanes/node/errors.ts";
import { createRpcNode } from "../../src/bitcoin-alkanes/node/node.ts";
import {
  bytecodeRequestOfTwoZero,
  confirmedTransaction,
  dieselName,
  dieselNameRequest,
  feeEstimates,
  mainnetSuccessTrace,
  unknownTransaction,
  unspentOutputs,
} from "../support/recorded.ts";
import { scriptedRpc } from "../support/rpc.ts";

const diesel = { block: 2n, tx: 0n };
const txid = "aa9833a5bc390773b721d36947409d7077ea925034b5962c677fa8bec47f0bc2";
const tipAnswers = {
  "esplora_blocks:tip:hash":
    "000000000000000000016c19109a43d1fe19e274b74d11f3ed88713c287051f6",
  "esplora_blocks:tip:height": 971738,
};

describe("the Alkanes view", () => {
  it("runs at the chain's current height and decodes the answer", async () => {
    const { calls, rpc } = scriptedRpc({
      ...tipAnswers,
      metashrew_view: dieselName,
    });
    const answer = await createRpcNode(rpc).view(diesel, 99n, []);
    expect(answer.ok && new TextDecoder().decode(answer.data)).toBe("DIESEL");
    expect(calls.at(-1)).toEqual({
      method: "metashrew_view",
      params: ["simulate", dieselNameRequest, "latest"],
    });
  });

  it("asks for stored code and says null when nothing is deployed", async () => {
    const present = scriptedRpc({ metashrew_view: "0x0061736d" });
    expect(await createRpcNode(present.rpc).bytecode(diesel)).toEqual(
      Uint8Array.of(0, 0x61, 0x73, 0x6d),
    );
    expect(present.calls[0]?.params).toEqual([
      "getbytecode",
      bytecodeRequestOfTwoZero,
      "latest",
    ]);
    expect(
      await createRpcNode(scriptedRpc({ metashrew_view: "0x" }).rpc).bytecode(
        diesel,
      ),
    ).toBeNull();
  });

  it("refuses answers that are not text or not hexadecimal", async () => {
    await expect(
      createRpcNode(scriptedRpc({ metashrew_view: 5 }).rpc).bytecode(diesel),
    ).rejects.toThrow("not text");
    await expect(
      createRpcNode(scriptedRpc({ metashrew_view: "0xzz" }).rpc).bytecode(
        diesel,
      ),
    ).rejects.toThrow("hexadecimal");
  });
});

describe("the indexed height", () => {
  it("is the number the indexer reports", async () => {
    expect(
      await createRpcNode(
        scriptedRpc({ metashrew_height: "971742" }).rpc,
      ).indexedHeight(),
    ).toBe(971742);
  });

  it("refuses anything that is not a block height", async () => {
    for (const answer of ["x", "-1", "1.5", ""]) {
      await expect(
        createRpcNode(
          scriptedRpc({ metashrew_height: answer }).rpc,
        ).indexedHeight(),
        answer,
      ).rejects.toThrow("not a block height");
    }
    await expect(
      createRpcNode(scriptedRpc({ metashrew_height: 5 }).rpc).indexedHeight(),
    ).rejects.toThrow("not text");
  });
});

describe("a trace", () => {
  it("is asked for by the transaction id as Bitcoin hashes it, and decoded", async () => {
    const { calls, rpc } = scriptedRpc({ metashrew_view: mainnetSuccessTrace });
    expect((await createRpcNode(rpc).trace(txid, 3)).outcome).toBe("success");
    // The same request the live node answered with this trace: the id reversed, then the output index.
    expect(calls[0]?.params).toEqual([
      "trace",
      "0x0a20c20b7fc4bea87f672c96b5345092ea77709d404769d321b7730739bca53398aa1003",
      "latest",
    ]);
  });

  it("refuses a transaction id that is not thirty-two bytes", async () => {
    await expect(
      createRpcNode(scriptedRpc({}).rpc).trace("abcd", 0),
    ).rejects.toThrow("thirty-two");
  });
});

describe("the chain side", () => {
  it("reads the tip", async () => {
    expect(await createRpcNode(scriptedRpc(tipAnswers).rpc).tip()).toEqual({
      hash: tipAnswers["esplora_blocks:tip:hash"],
      height: 971738,
    });
    await expect(
      createRpcNode(
        scriptedRpc({ ...tipAnswers, "esplora_blocks:tip:height": "7" }).rpc,
      ).tip(),
    ).rejects.toThrow("not a whole number");
  });

  it("reads the tip's height with one call, not the two the tip itself takes", async () => {
    const { calls, rpc } = scriptedRpc(tipAnswers);
    expect(await createRpcNode(rpc).tipHeight()).toBe(971738);
    expect(calls).toEqual([
      { method: "esplora_blocks:tip:height", params: [] },
    ]);
    await expect(
      createRpcNode(
        scriptedRpc({ ...tipAnswers, "esplora_blocks:tip:height": "7" }).rpc,
      ).tipHeight(),
    ).rejects.toThrow("not a whole number");
  });

  it("reads the hash of the block at a height, and refuses an answer that is not one", async () => {
    const genesis =
      "00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043";
    const { calls, rpc } = scriptedRpc({ "esplora_block-height": genesis });
    expect(await createRpcNode(rpc).blockHash(0)).toBe(genesis);
    expect(calls).toEqual([{ method: "esplora_block-height", params: [0] }]);
    for (const bad of ["Block not found", genesis.toUpperCase(), 7]) {
      await expect(
        createRpcNode(
          scriptedRpc({ "esplora_block-height": bad }).rpc,
        ).blockHash(0),
      ).rejects.toThrow();
    }
  });

  it("lists unspent outputs with their confirmation", async () => {
    const { calls, rpc } = scriptedRpc({
      "esplora_address::utxo": unspentOutputs,
    });
    expect(
      await createRpcNode(rpc).utxos(
        "bc1q5dvzcpjl0ws25r3le74fjte05es05tmgsrmlg3",
      ),
    ).toEqual([
      {
        confirmed: true,
        txid: "685680e1dc3b527646eace44a0040485ff4f446f7f3d58de8dda52e6593890c4",
        value: 1212916n,
        vout: 57,
      },
      {
        confirmed: false,
        txid: "dbb2944639faca8acc6182ab8d7e28f1c7c9040c602d2fcc144b75093aee30b8",
        value: 1038348n,
        vout: 0,
      },
    ]);
    expect(calls[0]?.params).toEqual([
      "bc1q5dvzcpjl0ws25r3le74fjte05es05tmgsrmlg3",
    ]);
  });

  it("refuses unspent outputs that are malformed", async () => {
    const bad = (entry: JsonValue) =>
      createRpcNode(
        scriptedRpc({ "esplora_address::utxo": [entry] }).rpc,
      ).utxos("a");
    await expect(
      bad({ status: {}, txid: "a", value: 1, vout: 0 }),
    ).rejects.toThrow("no status");
    await expect(
      bad({ status: { confirmed: true }, txid: "a", value: -1, vout: 0 }),
    ).rejects.toThrow("whole number");
    await expect(
      createRpcNode(scriptedRpc({ "esplora_address::utxo": "none" }).rpc).utxos(
        "a",
      ),
    ).rejects.toThrow("not a list");
  });

  it("picks the fee estimate for the target, or the nearest slower one", async () => {
    const node = createRpcNode(
      scriptedRpc({ "esplora_fee-estimates": feeEstimates }).rpc,
    );
    expect(await node.feeRate(1)).toBe(1.82);
    expect(await node.feeRate(3)).toBe(1.111);
    expect(await node.feeRate(4)).toBe(0.349);
    expect(await node.feeRate(1008)).toBe(0.1);
    await expect(node.feeRate(1009)).rejects.toThrow("no fee estimate");
  });

  it("ignores estimates that are not positive numbers", async () => {
    const node = createRpcNode(
      scriptedRpc({ "esplora_fee-estimates": { "1": 0, "2": "fast", "3": 2 } })
        .rpc,
    );
    expect(await node.feeRate(1)).toBe(2);
  });

  it("describes a confirmed transaction, an unconfirmed one, and one it does not know", async () => {
    const confirmed = createRpcNode(
      scriptedRpc({ esplora_tx: confirmedTransaction }).rpc,
    );
    expect(await confirmed.transaction(txid)).toEqual({
      blockHash:
        "00000000000000000000ab55cf71a471603e3a20939c700254cf3b0b1a9afbb2",
      blockHeight: 971742,
      confirmed: true,
      outputs: 2,
    });
    const mempool = createRpcNode(
      scriptedRpc({
        esplora_tx: { ...confirmedTransaction, status: { confirmed: false } },
      }).rpc,
    );
    expect(await mempool.transaction(txid)).toEqual({
      blockHash: null,
      blockHeight: null,
      confirmed: false,
      outputs: 2,
    });
    expect(
      await createRpcNode(
        scriptedRpc({ esplora_tx: unknownTransaction }).rpc,
      ).transaction(txid),
    ).toBeNull();
    await expect(
      createRpcNode(scriptedRpc({ esplora_tx: { vout: [] } }).rpc).transaction(
        txid,
      ),
    ).rejects.toThrow("not an object");
  });

  it("broadcasts and returns the id the node reports", async () => {
    const { calls, rpc } = scriptedRpc({ sendrawtransaction: txid });
    expect(await createRpcNode(rpc).broadcast("0200")).toBe(txid);
    expect(calls[0]).toEqual({
      method: "sendrawtransaction",
      params: ["0200"],
    });
  });

  it("takes an answer that is not a transaction id as a refusal, with the node's words, not as an unknown", async () => {
    const refused = createRpcNode(
      scriptedRpc({
        sendrawtransaction: 'endpoint does not exist "/broadcast/0200"',
      }).rpc,
    ).broadcast("0200");
    await expect(refused).rejects.toBeInstanceOf(NodeRejectedError);
    await expect(refused).rejects.toThrow("endpoint does not exist");
  });
});
