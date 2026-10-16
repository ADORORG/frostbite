import { describe, expect, it } from "vitest";
import type { JsonValue } from "@ador/shared/chain";

import { createRpcNode } from "../../src/bitcoin-alkanes/node/node.ts";
import type { JsonRpc } from "../../src/bitcoin-alkanes/node/transport.ts";
import {
  bytecodeRequestOfTwoZero,
  dieselName,
  dieselNameRequest,
} from "../support/recorded.ts";

function scripted(answers: Readonly<Record<string, JsonValue>>) {
  const calls: { method: string; params: readonly JsonValue[] }[] = [];
  const rpc: JsonRpc = {
    call: (method, params) => {
      calls.push({ method, params });
      const answer = answers[method];
      return answer === undefined
        ? Promise.reject(new Error(`unexpected ${method}`))
        : Promise.resolve(answer);
    },
  };
  return { calls, node: createRpcNode(rpc) };
}

const diesel = { block: 2n, tx: 0n };

describe("the RPC node", () => {
  it("runs a view at the indexed head and decodes the answer", async () => {
    const { calls, node } = scripted({
      "esplora_blocks:tip:height": 971738,
      metashrew_view: dieselName,
    });
    const answer = await node.view(diesel, 99n, []);
    expect(answer.ok && new TextDecoder().decode(answer.data)).toBe("DIESEL");
    expect(calls).toEqual([
      { method: "esplora_blocks:tip:height", params: [] },
      {
        method: "metashrew_view",
        params: ["simulate", dieselNameRequest, "latest"],
      },
    ]);
  });

  it("asks for stored code and says null when nothing is deployed", async () => {
    const present = scripted({ metashrew_view: "0x0061736d" });
    expect(await present.node.bytecode(diesel)).toEqual(
      Uint8Array.of(0, 0x61, 0x73, 0x6d),
    );
    expect(present.calls[0]?.params).toEqual([
      "getbytecode",
      bytecodeRequestOfTwoZero,
      "latest",
    ]);
    expect(
      await scripted({ metashrew_view: "0x" }).node.bytecode(diesel),
    ).toBeNull();
  });

  it("reports the height", async () => {
    expect(
      await scripted({ "esplora_blocks:tip:height": 7 }).node.height(),
    ).toBe(7);
  });

  it("refuses answers that are not what was asked for", async () => {
    for (const height of ["7", -1, 1.5, null]) {
      await expect(
        scripted({ "esplora_blocks:tip:height": height }).node.height(),
      ).rejects.toThrow("not a block height");
    }
    await expect(
      scripted({ metashrew_view: 5 }).node.bytecode(diesel),
    ).rejects.toThrow("not text");
    await expect(
      scripted({ metashrew_view: "0xzz" }).node.bytecode(diesel),
    ).rejects.toThrow("hexadecimal");
  });
});
