import type { FetchLike } from "@frostbite/client-http";
import { ApiError } from "@frostbite/client-http";
import { describe, expect, it } from "vitest";

import { createChainStatusApi, indexingTimeoutMs } from "../src/client/api.ts";
import { ok } from "./support/fee-fixtures.ts";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

describe("asking the platform how the chain is doing", () => {
  it("makes one same-origin GET to the shared route and returns the checked answer", async () => {
    const seen: { method: string; url: string }[] = [];
    const fetchImpl: FetchLike = async (url, init) => {
      seen.push({ method: init.method, url });
      return reply({ state: "none" });
    };
    const answer = await createChainStatusApi(fetchImpl).indexing(
      new AbortController().signal,
    );
    expect(answer).toEqual({ state: "none" });
    expect(seen).toEqual([{ method: "GET", url: "/api/v1/chain/indexing" }]);
  });

  it("refuses an answer that is not in the shared contract", async () => {
    const api = createChainStatusApi(async () =>
      reply({ health: "fine", state: "ok" }),
    );
    await expect(
      api.indexing(new AbortController().signal),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("gives up on a slow answer, and on the caller's own abort", async () => {
    expect(indexingTimeoutMs).toBeGreaterThan(0);
    let signal: AbortSignal | undefined;
    const api = createChainStatusApi(async (_url, init) => {
      signal = init.signal;
      return reply({ state: "none" });
    });
    const caller = new AbortController();
    await api.indexing(caller.signal);
    expect(signal?.aborted).toBe(false);
    caller.abort();
    expect(signal?.aborted).toBe(true);
  });

  it("asks for the fee market the same way: one same-origin GET, an answer checked against the contract", async () => {
    const seen: { method: string; url: string }[] = [];
    const answer = await createChainStatusApi(async (url, init) => {
      seen.push({ method: init.method, url });
      return reply(ok);
    }).fees(new AbortController().signal);
    expect(answer).toEqual(ok);
    expect(seen).toEqual([{ method: "GET", url: "/api/v1/chain/fees" }]);
    await expect(
      createChainStatusApi(async () => reply({ state: "ok" })).fees(
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("stops waiting for fees on the caller's abort", async () => {
    let signal: AbortSignal | undefined;
    const caller = new AbortController();
    await createChainStatusApi(async (_url, init) => {
      signal = init.signal;
      return reply(ok);
    }).fees(caller.signal);
    expect(signal?.aborted).toBe(false);
    caller.abort();
    expect(signal?.aborted).toBe(true);
  });
});
