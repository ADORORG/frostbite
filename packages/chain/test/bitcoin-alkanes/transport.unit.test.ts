import { describe, expect, it } from "vitest";
import type { JsonValue } from "@ador/shared/chain";

import {
  NodeRejectedError,
  NodeUnavailableError,
} from "../../src/bitcoin-alkanes/node/errors.ts";
import {
  createJsonRpc,
  type FetchLike,
} from "../../src/bitcoin-alkanes/node/transport.ts";

function answering(body: JsonValue, status = 200): FetchLike {
  return () =>
    Promise.resolve({
      json: () => Promise.resolve(body),
      ok: status >= 200 && status < 300,
      status,
    });
}

const rpc = (fetch: FetchLike) =>
  createJsonRpc({ fetch, timeoutMs: 1000, url: "https://node.example/rpc" });

describe("the JSON-RPC transport", () => {
  it("posts a numbered request and returns the result", async () => {
    const seen: { body: string; url: string; signal: AbortSignal }[] = [];
    const client = rpc((url, init) => {
      seen.push({ body: init.body, signal: init.signal, url });
      return answering({ id: seen.length, jsonrpc: "2.0", result: "0x01" })(
        url,
        init,
      );
    });
    expect(
      await client.call("metashrew_view", ["simulate", "0x", "latest"]),
    ).toBe("0x01");
    expect(await client.call("esplora_blocks:tip:height", [])).toBe("0x01");
    expect(seen.map(({ url }) => url)).toEqual([
      "https://node.example/rpc",
      "https://node.example/rpc",
    ]);
    expect(JSON.parse(seen[1]?.body ?? "")).toEqual({
      id: 2,
      jsonrpc: "2.0",
      method: "esplora_blocks:tip:height",
      params: [],
    });
    expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports a node that refuses the request, with its message", async () => {
    const client = rpc(
      answering({
        error: { code: -32000, message: "Invalid hex" },
        id: 1,
        jsonrpc: "2.0",
      }),
    );
    await expect(client.call("m", [])).rejects.toThrow(
      new NodeRejectedError("Invalid hex"),
    );
    const bare = rpc(answering({ error: "nope", id: 1, jsonrpc: "2.0" }));
    await expect(bare.call("m", [])).rejects.toThrow("The node refused m.");
  });

  it("treats a bad status, an unreachable node and a malformed answer as unavailable", async () => {
    await expect(rpc(answering({}, 503)).call("m", [])).rejects.toThrow(
      "HTTP 503",
    );
    const down = rpc(() => Promise.reject(new Error("ECONNREFUSED")));
    await expect(down.call("m", [])).rejects.toBeInstanceOf(
      NodeUnavailableError,
    );
    await expect(rpc(answering("text")).call("m", [])).rejects.toThrow(
      "not a JSON-RPC response",
    );
    await expect(rpc(answering([1])).call("m", [])).rejects.toThrow(
      "not a JSON-RPC response",
    );
    await expect(
      rpc(answering({ id: 99, jsonrpc: "2.0", result: 1 })).call("m", []),
    ).rejects.toThrow("not a JSON-RPC response");
    await expect(
      rpc(answering({ id: 1, jsonrpc: "2.0" })).call("m", []),
    ).rejects.toThrow("no result");
  });

  it("treats an answer that is not JSON as unavailable", async () => {
    const broken: FetchLike = () =>
      Promise.resolve({
        json: () => Promise.reject(new SyntaxError("bad")),
        ok: true,
        status: 200,
      });
    await expect(rpc(broken).call("m", [])).rejects.toBeInstanceOf(
      NodeUnavailableError,
    );
  });

  it("refuses a timeout that is not a positive whole number", () => {
    for (const timeoutMs of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        createJsonRpc({ fetch: answering({}), timeoutMs, url: "u" }),
      ).toThrow("timeout");
    }
  });
});
