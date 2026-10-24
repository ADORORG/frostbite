import type { JsonValue } from "@ador/shared/chain";
import { describe, expect, it, vi } from "vitest";

import { BitcoindError, type Bitcoind } from "../src/bitcoind.ts";
import { createGateway, GatewayError } from "../src/gateway.ts";

const txid = "a".repeat(64);
const blockHash = "b".repeat(64);

function fakes(answers: Record<string, JsonValue | Error> = {}) {
  const bitcoin: Bitcoind = {
    call: vi.fn(async (method: string) => {
      const answer = answers[method];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) throw new Error(`unexpected ${method}`);
      return answer;
    }),
  };
  const indexer = vi.fn(async (method: string): Promise<JsonValue> =>
    method === "metashrew_height" ? 7 : "0xabcd",
  );
  const gateway = createGateway({
    bitcoin,
    feeEstimates: { "1": 2, "6": 1 },
    indexer,
  });
  return { bitcoin, gateway, indexer };
}

describe("the regtest gateway", () => {
  it("answers the tip, the fee estimates and a broadcast from Bitcoin Core", async () => {
    const { bitcoin, gateway } = fakes({
      getbestblockhash: blockHash,
      getblockcount: 101,
      sendrawtransaction: txid,
    });
    expect(await gateway("esplora_blocks:tip:height", [])).toBe(101);
    expect(await gateway("esplora_blocks:tip:hash", [])).toBe(blockHash);
    expect(await gateway("esplora_fee-estimates", [])).toEqual({
      "1": 2,
      "6": 1,
    });
    expect(await gateway("sendrawtransaction", ["0200"])).toBe(txid);
    expect(bitcoin.call).toHaveBeenCalledWith("sendrawtransaction", ["0200"]);
  });

  it("shows a confirmed transaction with its block, and an unconfirmed one without", async () => {
    const confirmed = fakes({
      getblockheader: { height: 99 },
      getrawtransaction: { blockhash: blockHash, vout: [{ n: 0 }, { n: 1 }] },
    });
    expect(await confirmed.gateway("esplora_tx", [txid])).toEqual({
      status: { block_hash: blockHash, block_height: 99, confirmed: true },
      txid,
      vout: [{ n: 0 }, { n: 1 }],
    });
    expect(confirmed.bitcoin.call).toHaveBeenCalledWith("getrawtransaction", [
      txid,
      true,
    ]);
    const pending = fakes({ getrawtransaction: { vout: [] } });
    expect(await pending.gateway("esplora_tx", [txid])).toEqual({
      status: { confirmed: false },
      txid,
      vout: [],
    });
  });

  it("answers a transaction Core does not know with plain text, and lets any other failure through", async () => {
    const unknown = fakes({
      getrawtransaction: new BitcoindError(-5, "No such mempool transaction"),
    });
    expect(await unknown.gateway("esplora_tx", [txid])).toBe(
      "Transaction not found",
    );
    const broken = fakes({
      getrawtransaction: new BitcoindError(-28, "Loading block index"),
    });
    await expect(broken.gateway("esplora_tx", [txid])).rejects.toThrow(
      "Loading block index",
    );
  });

  it("lists an address's unspent outputs in satoshis, as confirmed", async () => {
    const { bitcoin, gateway } = fakes({
      scantxoutset: {
        unspents: [
          { amount: 0.00001234, height: 5, txid, vout: 1 },
          { amount: 50, height: 6, txid: "c".repeat(64), vout: 0 },
        ],
      },
    });
    expect(await gateway("esplora_address::utxo", ["bcrt1qaddress"])).toEqual([
      {
        status: { block_height: 5, confirmed: true },
        txid,
        value: 1234,
        vout: 1,
      },
      {
        status: { block_height: 6, confirmed: true },
        txid: "c".repeat(64),
        value: 5_000_000_000,
        vout: 0,
      },
    ]);
    expect(bitcoin.call).toHaveBeenCalledWith("scantxoutset", [
      "start",
      ["addr(bcrt1qaddress)"],
    ]);
  });

  it("gives the indexer's height as text and passes a view through unchanged", async () => {
    const { gateway, indexer } = fakes();
    expect(await gateway("metashrew_height", [])).toBe("7");
    expect(
      await gateway("metashrew_view", ["simulate", "0x00", "latest"]),
    ).toBe("0xabcd");
    // "latest" is asked as the height the indexer has reached; any other height is passed on as it is.
    expect(indexer).toHaveBeenLastCalledWith("metashrew_view", [
      "simulate",
      "0x00",
      7,
    ]);
    await gateway("metashrew_view", ["trace", "0x01", 5]);
    expect(indexer).toHaveBeenLastCalledWith("metashrew_view", [
      "trace",
      "0x01",
      5,
    ]);
  });

  it("refuses a method it does not answer, and parameters that are not what the method takes", async () => {
    const { gateway } = fakes({ scantxoutset: { unspents: [{ txid }] } });
    await expect(gateway("esplora_blocks", [])).rejects.toMatchObject({
      code: -32601,
    });
    for (const method of [
      "esplora_tx",
      "sendrawtransaction",
      "esplora_address::utxo",
    ])
      await expect(gateway(method, [])).rejects.toBeInstanceOf(GatewayError);
    await expect(gateway("esplora_tx", [7])).rejects.toBeInstanceOf(
      GatewayError,
    );
    await expect(
      gateway("esplora_address::utxo", ["bcrt1q"]),
    ).rejects.toBeInstanceOf(GatewayError);
  });

  it("refuses answers from Core that are not the shape the platform relies on", async () => {
    const wrongObject = fakes({ getrawtransaction: [] });
    await expect(wrongObject.gateway("esplora_tx", [txid])).rejects.toThrow(
      "something else than an object",
    );
    const wrongList = fakes({ getrawtransaction: { vout: "none" } });
    await expect(wrongList.gateway("esplora_tx", [txid])).rejects.toThrow(
      "something else than a list",
    );
    const wrongHeight = fakes({
      getblockheader: { height: "tall" },
      getrawtransaction: { blockhash: blockHash, vout: [] },
    });
    await expect(wrongHeight.gateway("esplora_tx", [txid])).rejects.toThrow(
      "not a whole number",
    );
    const noAmount = fakes({
      scantxoutset: { unspents: [{ height: 1, txid, vout: 0 }] },
    });
    await expect(
      noAmount.gateway("esplora_address::utxo", ["bcrt1q"]),
    ).rejects.toThrow("no amount");
  });
});
