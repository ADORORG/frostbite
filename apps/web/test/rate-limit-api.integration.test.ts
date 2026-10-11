import { randomUUID } from "node:crypto";

import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { parseDatabaseEnvironment, runMigrations } from "@ador/database";
import { beforeAll, describe, expect, it } from "vitest";

import { GET } from "../src/app/api/v1/[...segments]/route.js";

const context = { params: Promise.resolve({ segments: ["platform"] }) };
// A public operation with no limit of its own: the anonymous allowance applies (60 a minute) beneath the
// per-address one (600 a minute).
const call = (address: string | null) =>
  GET(
    new Request("http://platform.invalid/api/v1/platform", {
      headers:
        address === null ? {} : { "x-forwarded-for": `9.9.9.9, ${address}` },
    }),
    context,
  );
const uniqueAddress = () =>
  `203.0.113.${String(Math.floor(Math.random() * 250) + 1)}-${randomUUID()}`;

beforeAll(async () => runMigrations(parseDatabaseEnvironment(process.env)));

describe("rate limiting at the API boundary", () => {
  it("answers 429 with the platform's error envelope and how long to wait, once an address is over its allowance", async () => {
    const address = uniqueAddress();
    for (let n = 0; n < 60; n += 1)
      expect((await call(address)).status).toBe(200);
    const refused = await call(address);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThanOrEqual(
      1,
    );
    expect(httpErrorEnvelopeSchema.parse(await refused.json()).error.code).toBe(
      "rate_limited",
    );
    expect(refused.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("counts each address on its own, and reads the address the trusted proxy recorded, not what the client claimed", async () => {
    const first = uniqueAddress();
    for (let n = 0; n < 61; n += 1) await call(first);
    expect((await call(first)).status).toBe(429);
    // Another real address, behind the same claimed first entry, is not limited.
    expect((await call(uniqueAddress())).status).toBe(200);
  });

  it("does not limit a request that carries no address from a trusted proxy", async () => {
    for (let n = 0; n < 70; n += 1) expect((await call(null)).status).toBe(200);
  });
});
