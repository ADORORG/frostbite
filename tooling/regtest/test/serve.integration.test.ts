import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";

import { createGateway, GatewayError } from "../src/gateway.ts";
import { serveGateway } from "../src/serve.ts";

let server: Server | null = null;
afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

async function start() {
  const gateway = createGateway({
    bitcoin: {
      call: async (method) => {
        if (method === "getblockcount") return 12;
        throw new Error("Core is down");
      },
    },
    feeEstimates: { "1": 1 },
    indexer: async () => 12,
  });
  server = await serveGateway({ gateway, port: 0 });
  const { port } = server.address() as AddressInfo;
  return (body: string) =>
    fetch(`http://127.0.0.1:${port}`, {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
    }).then((response) => response.json() as Promise<unknown>);
}

describe("the regtest gateway over HTTP", () => {
  it("answers a JSON-RPC request with its result and its id", async () => {
    const post = await start();
    expect(
      await post(
        JSON.stringify({
          id: 9,
          jsonrpc: "2.0",
          method: "esplora_blocks:tip:height",
          params: [],
        }),
      ),
    ).toEqual({ id: 9, jsonrpc: "2.0", result: 12 });
    expect(
      await post(JSON.stringify({ id: 1, method: "metashrew_height" })),
    ).toEqual({ id: 1, jsonrpc: "2.0", result: "12" });
  });

  it("answers a method it does not know, a request that is not one, and a failing Core, each as an error", async () => {
    const post = await start();
    expect(
      await post(JSON.stringify({ id: 2, method: "nope", params: [] })),
    ).toMatchObject({ error: { code: -32601 }, id: 2 });
    for (const bad of ["not json", "[]", JSON.stringify({ id: 3, method: 5 })])
      expect(await post(bad)).toMatchObject({
        error: { message: expect.any(String) },
      });
    expect(
      await post(
        JSON.stringify({
          id: 4,
          method: "esplora_blocks:tip:hash",
          params: [],
        }),
      ),
    ).toMatchObject({
      error: { code: -32603, message: "Core is down" },
      id: 4,
    });
    expect(new GatewayError(1, "x").code).toBe(1);
  });
});
