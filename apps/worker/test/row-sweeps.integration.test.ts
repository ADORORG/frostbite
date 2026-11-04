import { randomUUID } from "node:crypto";

import {
  contactCodes,
  parseDatabaseEnvironment,
  runMigrations,
  walletChallenges,
  type ExpiredRowCounts,
} from "@ador/database";
import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createWorkerRuntime } from "../src/runtime.ts";
import { database } from "./support/database.ts";

beforeAll(async () => runMigrations(parseDatabaseEnvironment(process.env)));
beforeEach(async () => {
  await database.delete(contactCodes);
  await database.delete(walletChallenges);
});
afterAll(async () => {
  await database.delete(contactCodes);
  await database.delete(walletChallenges);
});

const minute = 60_000;
const hour = 60 * minute;
const ago = (ms: number) => new Date(Date.now() - ms);
const challenge = (issuedAgo: number, expiresAgo: number) => ({
  action: "sign-in" as const,
  address: "tb1qexample",
  attempts: 0,
  domain: "example.test",
  expiresAt: ago(expiresAgo),
  id: randomUUID(),
  issuedAt: ago(issuedAgo),
  messageHash: "b".repeat(64),
  network: "signet",
  nonce: randomUUID(),
  origin: "https://example.test",
  requestId: randomUUID(),
  schemaVersion: 1,
  scriptIdentity: "script",
  signatureScheme: "bip322-simple",
  uri: "https://example.test",
  walletAdapter: "unisat",
});
const code = (issuedAgo: number, expiresAgo: number) => ({
  codeHash: "c".repeat(64),
  destination: `${randomUUID().slice(0, 8)}@example.test`,
  expiresAt: ago(expiresAgo),
  id: randomUUID(),
  issuedAt: ago(issuedAgo),
  kind: "email",
  salt: "salt",
});

describe("removing finished rows through the real worker and database", () => {
  it("removes expired rows in batches until none are left, keeps the rest, and reports what went", async () => {
    await database
      .insert(walletChallenges)
      .values([
        ...Array.from({ length: 25 }, () => challenge(10 * minute, 5 * minute)),
        challenge(minute, -minute),
      ]);
    await database.insert(contactCodes).values([
      // Expired but still inside the send limits' look-back: kept.
      code(20 * minute, 10 * minute),
      // Expired and past the look-back: removed.
      code(3 * hour, 2 * hour),
    ]);
    const runtime = createWorkerRuntime({
      environment: process.env,
      providers: createProviderRegistry([]),
      rowSweepLimits: {
        batchSize: 10,
        contactCodeRetentionMs: hour,
        deliveredOutboxRetentionMs: 7 * 24 * hour,
      },
    });
    const stop = new AbortController();
    const reports: ExpiredRowCounts[] = [];
    const errors: Error[] = [];
    const running = runtime.runRowSweeps(stop.signal, {
      onError: (error) => void errors.push(error),
      onResult: (counts) => void reports.push(counts),
    });
    try {
      await expect
        .poll(
          async () => (await database.select().from(walletChallenges)).length,
          {
            timeout: 10_000,
          },
        )
        .toBe(1);
      // 25 expired rows in batches of 10: three passes (10, 10, 5), each reported.
      expect(reports.map(({ walletChallenges: removed }) => removed)).toEqual([
        10, 10, 5,
      ]);
      expect(
        reports.reduce(
          (total, { contactCodes: removed }) => total + removed,
          0,
        ),
      ).toBe(1);
      expect(await database.select().from(contactCodes)).toHaveLength(1);
      expect(errors).toEqual([]);
    } finally {
      stop.abort();
      await running;
      await runtime.close();
    }
  });
});
