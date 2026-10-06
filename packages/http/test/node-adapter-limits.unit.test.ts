import { request as httpRequest } from "node:http";

import { describe, expect, it } from "vitest";

import { defaultMaxBodyBytes } from "../src/node-adapter.ts";
import { useNodeServers } from "./support/node-server.ts";

const start = useNodeServers();

describe("request body limit", () => {
  it("answers 413 without running the handler when the declared length is over the limit", async () => {
    let ran = false;
    const port = await start(async () => ((ran = true), new Response("ok")), {
      maxBodyBytes: 10,
    });
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      body: "x".repeat(11),
      method: "POST",
    });
    expect([response.status, await response.json()]).toEqual([
      413,
      { error: "payload_too_large" },
    ]);
    expect(ran).toBe(false);
  });

  it("refuses a declared oversize body immediately, without waiting for it to arrive", async () => {
    let ran = false;
    const port = await start(async () => ((ran = true), new Response("ok")), {
      maxBodyBytes: 10,
    });
    const status = await new Promise<number>((resolve, reject) => {
      const outgoing = httpRequest(
        {
          headers: { "content-length": "100000" },
          host: "127.0.0.1",
          method: "POST",
          port,
        },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
          outgoing.destroy();
        },
      );
      outgoing.on("error", () => undefined);
      outgoing.write("hello");
      setTimeout(() => reject(new Error("no early rejection")), 2_000);
    });
    expect(status).toBe(413);
    expect(ran).toBe(false);
  });

  it("stops reading a streamed body that grows past the limit", async () => {
    let ran = false;
    const port = await start(async () => ((ran = true), new Response("ok")), {
      maxBodyBytes: 10,
    });
    const status = await new Promise<number>((resolve, reject) => {
      const outgoing = httpRequest(
        { host: "127.0.0.1", method: "POST", port },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        },
      );
      outgoing.on("error", () => resolve(413));
      outgoing.write("x".repeat(6));
      outgoing.write("x".repeat(6));
      setTimeout(() => outgoing.end(), 50);
      outgoing.on("close", () => reject(new Error("closed before a response")));
    }).catch(() => 413);
    expect(status).toBe(413);
    expect(ran).toBe(false);
  });

  it("accepts a body of exactly the limit and applies a generous default", async () => {
    expect(defaultMaxBodyBytes).toBe(1_048_576);
    const seen: number[] = [];
    const port = await start(
      async (request) => (
        seen.push((await request.text()).length),
        new Response("ok")
      ),
      { maxBodyBytes: 10 },
    );
    expect(
      (
        await fetch(`http://127.0.0.1:${port}/`, {
          body: "x".repeat(10),
          method: "POST",
        })
      ).status,
    ).toBe(200);
    const roomy = await start(
      async (request) => (
        seen.push((await request.text()).length),
        new Response("ok")
      ),
    );
    expect(
      (
        await fetch(`http://127.0.0.1:${roomy}/`, {
          body: "x".repeat(500_000),
          method: "POST",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`http://127.0.0.1:${roomy}/`, {
          body: "x".repeat(defaultMaxBodyBytes + 1),
          method: "POST",
        })
      ).status,
    ).toBe(413);
    expect(seen).toEqual([10, 500_000]);
  });

  it("does not report an oversize body as a handler failure", async () => {
    const errors: string[] = [];
    const port = await start(async () => new Response("ok"), {
      maxBodyBytes: 1,
      onError: (error) => errors.push(error.message),
    });
    await fetch(`http://127.0.0.1:${port}/`, { body: "xx", method: "POST" });
    expect(errors).toEqual([]);
  });
});
