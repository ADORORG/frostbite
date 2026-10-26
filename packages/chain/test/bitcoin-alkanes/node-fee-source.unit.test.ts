import type { JsonValue } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { ChainUnavailableError } from "../../src/ports.ts";
import { createRpcNode } from "../../src/bitcoin-alkanes/node/node.ts";
import type { JsonRpc } from "../../src/bitcoin-alkanes/node/transport.ts";
import { createFeeSource, type GetLike } from "../../src/fee-sources/index.ts";

// Each level a different number, so a wrong mapping shows.
const recommended = {
  economyFee: 4,
  fastestFee: 7,
  halfHourFee: 6,
  hourFee: 5,
  minimumFee: 1,
};

function answering(body: unknown, status = 200): GetLike {
  return () =>
    Promise.resolve({
      json: () => Promise.resolve(body),
      ok: status >= 200 && status < 300,
      status,
    });
}

const api = (fetch: GetLike) =>
  createFeeSource({
    fetch,
    format: "mempool",
    kind: "explorer",
    timeoutMs: 1000,
    url: "https://explorer.example/net",
  });

// A node whose own estimates are the absurd ones the hosted gateways gave on 2026-10-24.
function absurdNode(): { asked: string[]; rpc: JsonRpc } {
  const asked: string[] = [];
  return {
    asked,
    rpc: {
      call: (method): Promise<JsonValue> => {
        asked.push(method);
        return Promise.resolve({ "1": 588235.294, "3": 587912.2, "25": 1.017 });
      },
    },
  };
}

describe("a node given a fee source", () => {
  it("prices from the source and never asks the node for estimates", async () => {
    const { asked, rpc } = absurdNode();
    const node = createRpcNode(rpc, api(answering(recommended)));
    expect(await node.feeRate(1)).toBe(7);
    expect(await node.feeRate(3)).toBe(6);
    expect((await node.feeRates([6, 25])).map((rate) => rate.satPerVb)).toEqual(
      [5, 4],
    );
    expect(asked).toEqual([]);
  });

  it("does not fall back to the node's estimate when the source fails", async () => {
    const { asked, rpc } = absurdNode();
    const node = createRpcNode(rpc, api(answering({}, 500)));
    await expect(node.feeRate(1)).rejects.toThrow(ChainUnavailableError);
    await expect(node.feeRates([1])).rejects.toThrow(ChainUnavailableError);
    expect(asked).toEqual([]);
  });

  it("reports a source that gives no rate for a target", async () => {
    const empty = { feeRates: () => Promise.resolve([]) };
    const node = createRpcNode(absurdNode().rpc, empty);
    await expect(node.feeRate(1)).rejects.toThrow("no rate for the target");
  });

  it("still uses the node's own estimates when it is given no source", async () => {
    const { asked, rpc } = absurdNode();
    const node = createRpcNode(rpc);
    expect(await node.feeRate(1)).toBe(588235.294);
    expect(asked).toEqual(["esplora_fee-estimates"]);
  });
});

describe("a node given the operator's fixed rate", () => {
  it("replaces the node's absurd estimates and asks nobody", async () => {
    const { asked, rpc } = absurdNode();
    const node = createRpcNode(
      rpc,
      createFeeSource({ kind: "fixed", satPerVb: 3 }),
    );
    expect(await node.feeRate(1)).toBe(3);
    expect(await node.feeRates([1, 6])).toEqual([
      { satPerVb: 3, targetBlocks: 1 },
      { satPerVb: 3, targetBlocks: 6 },
    ]);
    expect(asked).toEqual([]);
  });
});
