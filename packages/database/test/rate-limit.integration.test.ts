import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "../src/index.ts";
import { createPostgresRateLimiter } from "../src/rate-limit/postgres-limiter.ts";
import { rateLimitWindows } from "../src/schema/rate-limit.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const limiter = createPostgresRateLimiter(database);
const policy = { limit: 3, windowMs: 60_000 };
const start = new Date("2026-10-01T12:00:00.000Z");
const request = (overrides: object = {}) => ({
  bucket: "thing",
  now: start,
  policy,
  subject: "ip:1.2.3.4",
  ...overrides,
});

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(rateLimitWindows);
});
afterAll(async () => pool.end());

describe("the PostgreSQL rate limiter", () => {
  it("allows requests up to the limit in a window, then refuses, and says when to come back", async () => {
    const answers = [];
    for (let n = 0; n < 5; n += 1)
      answers.push(await limiter.consume(request()));
    expect(answers.map(({ allowed }) => allowed)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(answers.map(({ remaining }) => remaining)).toEqual([2, 1, 0, 0, 0]);
    expect(answers[3]?.retryAfterSeconds).toBe(60);
  });

  it("counts requests that arrive at the same moment exactly once each", async () => {
    const answers = await Promise.all(
      Array.from({ length: 20 }, () =>
        limiter.consume(request({ policy: { limit: 10, windowMs: 60_000 } })),
      ),
    );
    expect(answers.filter(({ allowed }) => allowed)).toHaveLength(10);
    const [row] = await database.select().from(rateLimitWindows);
    expect(row?.hits).toBe(20);
  });

  it("starts again in the next window", async () => {
    for (let n = 0; n < 4; n += 1) await limiter.consume(request());
    const next = await limiter.consume(
      request({ now: new Date(start.getTime() + 60_000) }),
    );
    expect([next.allowed, next.remaining]).toEqual([true, 2]);
  });

  it("keeps each subject and bucket apart", async () => {
    for (let n = 0; n < 3; n += 1) await limiter.consume(request());
    expect(
      (await limiter.consume(request({ subject: "ip:5.6.7.8" }))).remaining,
    ).toBe(2);
    expect(
      (await limiter.consume(request({ bucket: "other" }))).remaining,
    ).toBe(2);
    expect((await limiter.consume(request())).allowed).toBe(false);
  });

  it("stores the subject only as a hash, never as the address or user id", async () => {
    await limiter.consume(request({ subject: "ip:203.0.113.9" }));
    const [row] = await database.select().from(rateLimitWindows);
    expect(row?.subjectHash).toBe(
      createHash("sha256").update("ip:203.0.113.9").digest("hex"),
    );
    expect(JSON.stringify(row)).not.toContain("203.0.113.9");
  });

  it("clears windows more than two days old only when a request begins a new window", async () => {
    await limiter.consume(request({ subject: "ip:a" }));
    // An old row, written directly so that the request that wrote it did not clear anything.
    await database.insert(rateLimitWindows).values({
      bucket: "thing",
      hits: 1,
      subjectHash: "b".repeat(64),
      windowStart: new Date("2026-09-20T12:00:00.000Z"),
    });
    // A second request in the same window begins nothing, so the old row is left alone.
    await limiter.consume(request({ subject: "ip:a" }));
    expect(await database.select().from(rateLimitWindows)).toHaveLength(2);
    // The first request of someone else's window clears everything older than two days.
    await limiter.consume(request({ subject: "ip:c" }));
    const rows = await database.select().from(rateLimitWindows);
    expect(rows.map(({ windowStart }) => windowStart.toISOString())).toEqual([
      "2026-10-01T12:00:00.000Z",
      "2026-10-01T12:00:00.000Z",
    ]);
  });

  it("keeps a window that is less than two days old when it clears the rest", async () => {
    await database.insert(rateLimitWindows).values({
      bucket: "thing",
      hits: 1,
      subjectHash: "b".repeat(64),
      windowStart: new Date("2026-09-30T13:00:00.000Z"),
    });
    await limiter.consume(request({ subject: "ip:new" }));
    expect(await database.select().from(rateLimitWindows)).toHaveLength(2);
  });

  it("refuses to store a row the database cannot trust", async () => {
    await expect(
      database.insert(rateLimitWindows).values({
        bucket: "x",
        hits: 1,
        subjectHash: "not a hash",
        windowStart: start,
      }),
    ).rejects.toThrow();
    await expect(
      database.insert(rateLimitWindows).values({
        bucket: "x",
        hits: 0,
        subjectHash: "a".repeat(64),
        windowStart: start,
      }),
    ).rejects.toThrow();
    await expect(
      database.insert(rateLimitWindows).values({
        bucket: "",
        hits: 1,
        subjectHash: "a".repeat(64),
        windowStart: start,
      }),
    ).rejects.toThrow();
    expect(
      await database
        .select()
        .from(rateLimitWindows)
        .where(eq(rateLimitWindows.bucket, "x")),
    ).toEqual([]);
  });
});
