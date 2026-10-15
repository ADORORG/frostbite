import { describe, expect, it } from "vitest";

import { readJsonBody } from "../src/json-body.ts";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://launch.example/api/v1/x", {
    body,
    headers,
    method: "POST",
  });
const bytes = (...values: number[]) => new Uint8Array(values);

describe("reading a request's JSON body under a limit", () => {
  it("parses JSON of any shape that fits", async () => {
    expect(await readJsonBody(post('{"a":[1,null,"x"]}'))).toEqual({
      a: [1, null, "x"],
    });
    expect(await readJsonBody(post("[]"))).toEqual([]);
    expect(await readJsonBody(post("0"))).toBe(0);
  });

  it("accepts a body of exactly the limit and refuses one a byte over", async () => {
    const exactly = JSON.stringify("x".repeat(8));
    expect(exactly.length).toBe(10);
    expect(await readJsonBody(post(exactly), 10)).toBe("xxxxxxxx");
    expect(await readJsonBody(post(exactly), 9)).toBeUndefined();
  });

  it("refuses a declared length over the limit without taking the body's reader", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("1"));
        controller.close();
      },
    });
    const request = new Request("https://launch.example/api/v1/x", {
      body,
      duplex: "half",
      headers: { "content-length": "11" },
      method: "POST",
    } as RequestInit);
    expect(await readJsonBody(request, 10)).toBeUndefined();
    expect(request.bodyUsed).toBe(false);
  });

  it("stops reading a body that grows past the limit whatever it declared", async () => {
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new TextEncoder().encode("1".repeat(4)));
        if (chunks === 100) controller.close();
      },
    });
    const request = new Request("https://launch.example/api/v1/x", {
      body,
      duplex: "half",
      method: "POST",
    } as RequestInit);
    expect(await readJsonBody(request, 10)).toBeUndefined();
    expect(chunks).toBeLessThan(10);
  });

  it("answers undefined for no body, an empty one, text that is not JSON, and bytes that are not UTF-8", async () => {
    expect(await readJsonBody(post(null))).toBeUndefined();
    expect(await readJsonBody(post(""))).toBeUndefined();
    expect(await readJsonBody(post("{oops"))).toBeUndefined();
    expect(await readJsonBody(post(bytes(0x22, 0xff, 0x22)))).toBeUndefined();
  });
});
