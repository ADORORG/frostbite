import { request as httpRequest } from "node:http";

import { describe, expect, it } from "vitest";

import { useNodeServers } from "./support/node-server.ts";

const start = useNodeServers();

describe("node request listener", () => {
  it("passes method, URL, headers, and body to the handler and writes its response back", async () => {
    const seen: {
      body: string;
      contentType: string | null;
      method: string;
      url: string;
    }[] = [];
    const port = await start(async (request) => {
      seen.push({
        body: await request.text(),
        contentType: request.headers.get("content-type"),
        method: request.method,
        url: request.url,
      });
      return new Response("answer", {
        headers: { "x-test": "yes" },
        status: 202,
      });
    });
    const response = await fetch(`http://127.0.0.1:${port}/a/b?x=1`, {
      body: '{"k":1}',
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect([
      response.status,
      response.headers.get("x-test"),
      await response.text(),
    ]).toEqual([202, "yes", "answer"]);
    expect(seen).toEqual([
      {
        body: '{"k":1}',
        contentType: "application/json",
        method: "POST",
        url: `http://127.0.0.1:${port}/a/b?x=1`,
      },
    ]);
  });

  it("sends no body for GET and HEAD", async () => {
    const methods: string[] = [];
    const port = await start(async (request) => {
      methods.push(`${request.method}:${request.body === null}`);
      return new Response(null, { status: 204 });
    });
    await fetch(`http://127.0.0.1:${port}/`);
    await new Promise<void>((resolve, reject) => {
      const outgoing = httpRequest(
        { host: "127.0.0.1", method: "HEAD", port },
        (response) => {
          response.resume();
          response.on("end", resolve);
        },
      );
      outgoing.on("error", reject);
      outgoing.end();
    });
    expect(methods).toEqual(["GET:true", "HEAD:true"]);
  });

  it("ignores request headers that carry several values", async () => {
    const port = await start(
      async (request) =>
        new Response(String(request.headers.has("set-cookie"))),
    );
    const text = await new Promise<string>((resolve, reject) => {
      const outgoing = httpRequest(
        {
          headers: { "set-cookie": ["a=1", "b=2"] },
          host: "127.0.0.1",
          method: "GET",
          port,
        },
        (response) => {
          let body = "";
          response.on("data", (chunk) => (body += String(chunk)));
          response.on("end", () => resolve(body));
        },
      );
      outgoing.on("error", reject);
      outgoing.end();
    });
    expect(text).toBe("false");
  });

  it("reports each exchange to an observer without consuming the response", async () => {
    const observed: {
      body: string;
      method: string;
      status: number;
      text: string;
    }[] = [];
    const port = await start(
      async () => new Response("payload", { status: 201 }),
      {
        observe: async ({ body, request, response }) => {
          observed.push({
            body: Buffer.from(body).toString(),
            method: request.method,
            status: response.status,
            text: await response.text(),
          });
        },
      },
    );
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      body: "sent",
      method: "POST",
    });
    expect(await response.text()).toBe("payload");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(observed).toEqual([
      { body: "sent", method: "POST", status: 201, text: "payload" },
    ]);
  });

  it("answers a generic 500 and reports the error when the handler throws", async () => {
    const errors: string[] = [];
    const port = await start(
      async () => {
        throw new Error("secret detail");
      },
      { onError: (error) => errors.push(error.message) },
    );
    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"error":"internal"}');
    expect(errors).toEqual(["secret detail"]);
  });

  it("wraps a non-error throw and works without an error hook", async () => {
    const errors: string[] = [];
    const reported = await start(async () => Promise.reject("plain string"), {
      onError: (error) => errors.push(error.message),
    });
    expect((await fetch(`http://127.0.0.1:${reported}/`)).status).toBe(500);
    expect(errors).toEqual(["Handler failed."]);
    const silent = await start(async () => Promise.reject(new Error("x")));
    expect((await fetch(`http://127.0.0.1:${silent}/`)).status).toBe(500);
  });
});
