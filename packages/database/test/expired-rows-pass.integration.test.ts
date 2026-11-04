import { describe, expect, it } from "vitest";

import {
  outboxEvents,
  removeExpiredRows,
  contactCodes,
  walletChallenges,
} from "../src/index.ts";
import {
  code,
  database,
  hour,
  left,
  limits,
  minute,
  now,
  outbox,
  day,
  useExpiredRowsWorld,
  wallet,
} from "./support/expired-rows-world.ts";

useExpiredRowsWorld();

describe("delivered outbox events", () => {
  it("removes a delivered event older than its retention and keeps a younger one", async () => {
    await database
      .insert(outboxEvents)
      .values([outbox("delivered", 8 * day), outbox("delivered", day)]);
    expect(
      (await removeExpiredRows(database, now, limits)).deliveredOutboxEvents,
    ).toBe(1);
    expect(await database.select().from(outboxEvents)).toHaveLength(1);
  });

  it("never removes an event that is waiting or failed, however old", async () => {
    await database
      .insert(outboxEvents)
      .values([outbox("pending", null), outbox("failed", null)]);
    expect(
      (await removeExpiredRows(database, now, limits)).deliveredOutboxEvents,
    ).toBe(0);
    expect(
      (await database.select().from(outboxEvents))
        .map(({ status }) => status)
        .sort(),
    ).toEqual(["failed", "pending"]);
  });
});

describe("a pass", () => {
  it("removes at most a batch from each table, and the next pass takes the rest", async () => {
    await database
      .insert(walletChallenges)
      .values(Array.from({ length: 5 }, () => wallet(10 * minute, 5 * minute)));
    await database
      .insert(contactCodes)
      .values(Array.from({ length: 5 }, () => code(3 * hour, 2 * hour)));
    const small = { ...limits, batchSize: 2 };
    const first = await removeExpiredRows(database, now, small);
    expect([first.walletChallenges, first.contactCodes]).toEqual([2, 2]);
    expect(await left(walletChallenges)).toBe(3);
    await removeExpiredRows(database, now, small);
    const last = await removeExpiredRows(database, now, small);
    expect([last.walletChallenges, last.contactCodes]).toEqual([1, 1]);
    expect(await removeExpiredRows(database, now, small)).toEqual({
      contactCodes: 0,
      deliveredOutboxEvents: 0,
      passkeyChallenges: 0,
      passkeySignInChallenges: 0,
      walletChallenges: 0,
    });
  });

  it("removes the oldest first", async () => {
    const rows = [
      wallet(30 * minute, 25 * minute),
      wallet(20 * minute, 15 * minute),
      wallet(10 * minute, 5 * minute),
    ];
    await database.insert(walletChallenges).values(rows);
    await removeExpiredRows(database, now, { ...limits, batchSize: 1 });
    expect(
      (await database.select().from(walletChallenges))
        .map(({ id }) => id)
        .sort(),
    ).toEqual([rows[1]?.id, rows[2]?.id].sort());
  });

  it("is safe to run twice at once: each row is removed once and nothing fails", async () => {
    await database
      .insert(walletChallenges)
      .values(
        Array.from({ length: 20 }, () => wallet(10 * minute, 5 * minute)),
      );
    const [a, b] = await Promise.all([
      removeExpiredRows(database, now, limits),
      removeExpiredRows(database, now, limits),
    ]);
    expect(a.walletChallenges + b.walletChallenges).toBe(20);
    expect(await left(walletChallenges)).toBe(0);
  });

  it.each([
    [{ ...limits, batchSize: 0 }],
    [{ ...limits, batchSize: 1.5 }],
    [{ ...limits, contactCodeRetentionMs: 0 }],
    [{ ...limits, deliveredOutboxRetentionMs: -1 }],
  ])("refuses limits that cannot work, and removes nothing", async (bad) => {
    await database
      .insert(walletChallenges)
      .values(wallet(10 * minute, 5 * minute));
    await expect(removeExpiredRows(database, now, bad)).rejects.toThrow();
    expect(await left(walletChallenges)).toBe(1);
  });
});
