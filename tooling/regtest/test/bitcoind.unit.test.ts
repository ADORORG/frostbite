import { describe, expect, it, vi } from "vitest";

import {
  BitcoindError,
  createBitcoind,
  type FetchLike,
} from "../src/bitcoind.ts";
import { isJsonObject, objectOf } from "../src/json.ts";

const answering = (body: unknown) =>
  vi.fn<FetchLike>(async () => ({ json: async () => body }));

describe("Bitcoin Core over JSON-RPC", () => {
  it("sends the method with basic authentication and answers the result", async () => {
    const send = answering({ error: null, id: 1, result: 101 });
    const core = createBitcoind({
      fetch: send,
      password: "pass",
      url: "http://127.0.0.1:18443",
      user: "user",
    });
    expect(await core.call("getblockcount")).toBe(101);
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe("http://127.0.0.1:18443");
    expect(init?.headers["authorization"]).toBe(
      `Basic ${Buffer.from("user:pass").toString("base64")}`,
    );
    expect(JSON.parse(init?.body ?? "")).toEqual({
      id: 1,
      jsonrpc: "1.0",
      method: "getblockcount",
      params: [],
    });
  });

  it("numbers each call, and addresses a wallet when one is named", async () => {
    const send = answering({ result: "x" });
    const core = createBitcoind({
      fetch: send,
      password: "p",
      url: "http://127.0.0.1:18443/",
      user: "u",
      wallet: "frostbite",
    });
    await core.call("getnewaddress", ["", "bech32"]);
    await core.call("getnewaddress");
    expect(send.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:18443/wallet/frostbite",
      "http://127.0.0.1:18443/wallet/frostbite",
    ]);
    expect(send.mock.calls.map(([, init]) => JSON.parse(init.body).id)).toEqual(
      [1, 2],
    );
  });

  it("raises Core's own code and message for a failed call, and a plain refusal for a malformed one", async () => {
    const core = (body: unknown) =>
      createBitcoind({
        fetch: answering(body),
        password: "p",
        url: "http://x",
        user: "u",
      });
    await expect(
      core({ error: { code: -5, message: "not found" }, result: null }).call(
        "getrawtransaction",
      ),
    ).rejects.toMatchObject({ code: -5, message: "not found" });
    await expect(
      core({ error: "boom", result: null }).call("x"),
    ).rejects.toMatchObject({ code: -1 });
    await expect(core([]).call("x")).rejects.toBeInstanceOf(BitcoindError);
    expect(await core({}).call("x")).toBeNull();
  });

  it("tells a JSON object from every other JSON value", () => {
    expect(isJsonObject({ a: 1 })).toBe(true);
    for (const other of [[], "x", 1, true, null, undefined])
      expect(isJsonObject(other)).toBe(false);
    expect(objectOf({ a: 1 })).toEqual({ a: 1 });
    expect(objectOf([1])).toBeNull();
  });
});
