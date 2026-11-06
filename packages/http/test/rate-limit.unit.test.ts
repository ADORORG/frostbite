import { rateLimitConfigSchema } from "@frostbite/shared/http";
import { describe, expect, it, vi } from "vitest";

import {
  clientAddress,
  createMemoryRateLimiter,
  createRateLimitGate,
} from "../src/rate-limit.ts";

const perMinute = (limit: number) => ({ limit, windowMs: 60_000 });
const at = (seconds: number) => new Date(seconds * 1_000);

describe("the in-process rate limiter", () => {
  const policy = perMinute(2);
  const request = (overrides: object = {}) => ({
    bucket: "thing",
    now: at(120),
    policy,
    subject: "ip:1.2.3.4",
    ...overrides,
  });

  it("allows up to the limit in a window and refuses beyond it, counting the refused too", async () => {
    const limiter = createMemoryRateLimiter();
    const answers = [];
    for (let at = 0; at < 4; at += 1)
      answers.push(await limiter.consume(request()));
    expect(answers.map(({ allowed }) => allowed)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(answers.map(({ remaining }) => remaining)).toEqual([1, 0, 0, 0]);
    expect(answers[2]?.retryAfterSeconds).toBe(60);
  });

  it("starts a new count when the window has passed", async () => {
    const limiter = createMemoryRateLimiter();
    await limiter.consume(request());
    await limiter.consume(request());
    expect((await limiter.consume(request())).allowed).toBe(false);
    expect((await limiter.consume(request({ now: at(181) }))).allowed).toBe(
      true,
    );
  });

  it("counts each subject and each bucket on its own", async () => {
    const limiter = createMemoryRateLimiter();
    await limiter.consume(request());
    await limiter.consume(request());
    expect(
      (await limiter.consume(request({ subject: "ip:5.6.7.8" }))).allowed,
    ).toBe(true);
    expect((await limiter.consume(request({ bucket: "other" }))).allowed).toBe(
      true,
    );
    expect((await limiter.consume(request())).allowed).toBe(false);
  });

  it("forgets windows that have passed, so it does not grow without end", async () => {
    const limiter = createMemoryRateLimiter();
    for (let n = 0; n < 50; n += 1)
      await limiter.consume(
        request({ now: at(120), subject: `ip:${String(n)}` }),
      );
    // A later window: every earlier subject starts from nothing again.
    await limiter.consume(request({ now: at(300), subject: "ip:new" }));
    expect(
      (await limiter.consume(request({ now: at(300), subject: "ip:3" })))
        .remaining,
    ).toBe(1);
  });
});

describe("the client address", () => {
  const headers = (value: string | null) => ({
    get: (name: string) => (name === "x-forwarded-for" ? value : null),
  });

  it("is the entry the first trusted proxy recorded, counted from the end", () => {
    expect(clientAddress(headers("9.9.9.9, 1.2.3.4"), 1)).toBe("1.2.3.4");
    expect(clientAddress(headers("evil, 5.6.7.8, 10.0.0.1"), 2)).toBe(
      "5.6.7.8",
    );
  });

  it("ignores what the client claimed before the trusted proxies", () => {
    expect(clientAddress(headers("6.6.6.6, 1.2.3.4"), 1)).toBe("1.2.3.4");
  });

  it("is nothing with no trusted proxy, no header, or fewer entries than proxies", () => {
    expect(clientAddress(headers("1.2.3.4"), 0)).toBeNull();
    expect(clientAddress(headers(null), 1)).toBeNull();
    expect(clientAddress(headers(""), 1)).toBeNull();
    expect(clientAddress(headers("1.2.3.4"), 2)).toBeNull();
    expect(clientAddress(headers(" , "), 1)).toBeNull();
  });
});

describe("the rate limit gate", () => {
  const config = rateLimitConfigSchema.parse({
    address: perMinute(3),
    anonymous: perMinute(2),
    operations: { createUploadIntent: perMinute(1) },
    read: perMinute(5),
    version: 1,
    write: perMinute(4),
  });
  const withHeaders = (value: string | null) => ({
    get: (name: string) => (name === "x-forwarded-for" ? value : null),
  });
  const setup = (overrides: object = {}) => {
    const onError = vi.fn();
    const gate = createRateLimitGate({
      config,
      limiter: createMemoryRateLimiter(),
      now: () => at(120),
      onError,
      trustedProxyHops: 1,
      ...overrides,
    });
    return { gate, onError };
  };
  const byAddress = (
    gate: ReturnType<typeof setup>["gate"],
    overrides: object = {},
  ) =>
    gate.byAddress({
      headers: withHeaders("1.2.3.4"),
      method: "GET",
      operationId: "listUploadedAssets",
      publicOperation: false,
      ...overrides,
    });

  it("limits everything from one address, and refuses the request over the limit", async () => {
    const { gate } = setup();
    for (let n = 0; n < 3; n += 1) expect(await byAddress(gate)).toBeNull();
    expect(await byAddress(gate)).toMatchObject({ allowed: false });
    expect(
      await byAddress(gate, { headers: withHeaders("5.6.7.8") }),
    ).toBeNull();
  });

  it("also applies a public operation's own limit, by address", async () => {
    const { gate } = setup();
    const publicCall = {
      operationId: "createUploadIntent",
      publicOperation: true,
    };
    expect(await byAddress(gate, publicCall)).toBeNull();
    expect(await byAddress(gate, publicCall)).toMatchObject({ allowed: false });
  });

  it("does not apply an operation's own limit by address when the operation needs a person", async () => {
    const { gate } = setup();
    expect(
      await byAddress(gate, { operationId: "createUploadIntent" }),
    ).toBeNull();
    expect(
      await byAddress(gate, { operationId: "createUploadIntent" }),
    ).toBeNull();
  });

  it("counts nothing, and refuses nothing, when there is no address to count against", async () => {
    const { gate } = setup();
    for (let n = 0; n < 10; n += 1)
      expect(await byAddress(gate, { headers: withHeaders(null) })).toBeNull();
  });

  it("limits a signed-in person by operation, on their own count", async () => {
    const { gate } = setup();
    const call = (userId: string, operationId = "createUploadIntent") =>
      gate.byPerson({ method: "POST", operationId, userId });
    expect(await call("a")).toBeNull();
    expect(await call("a")).toMatchObject({ allowed: false });
    expect(await call("b")).toBeNull();
    // Another operation of the same person has its own allowance.
    for (let n = 0; n < 4; n += 1)
      expect(await call("a", "saveCollectionDraft")).toBeNull();
    expect(await call("a", "saveCollectionDraft")).toMatchObject({
      allowed: false,
    });
  });

  it("lets a request through, and reports it, when the counter itself fails", async () => {
    const { gate, onError } = setup({
      limiter: {
        consume: async () => {
          throw new Error("database down");
        },
      },
    });
    expect(await byAddress(gate)).toBeNull();
    expect(
      await gate.byPerson({ method: "GET", operationId: "x", userId: "a" }),
    ).toBeNull();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "database down" }),
    );
  });

  it("reports a failure that is not an Error as a plain one", async () => {
    const { gate, onError } = setup({
      limiter: { consume: () => Promise.reject("boom") },
    });
    expect(await byAddress(gate)).toBeNull();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Rate limiter failed." }),
    );
  });
});
