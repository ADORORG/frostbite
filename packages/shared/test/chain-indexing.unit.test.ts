import { describe, expect, it } from "vitest";

import {
  indexingHealth,
  indexingStatusSchema,
  isDelayed,
  lagOf,
  sentAtAfter,
  trackedStates,
  stageOf,
  type DelayPolicy,
  type TransactionStage,
} from "../src/chain/index.ts";

const policy: DelayPolicy = { maxLagBlocks: 2, maxUnsettledMs: 60 * 60_000 };
const now = new Date("2026-10-17T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);
const at = (tipHeight: number, indexedHeight: number) => ({
  indexedHeight,
  tipHeight,
});

describe("how far behind the indexer is", () => {
  it("counts the blocks it has yet to read, and never counts an indexer ahead of the tip as behind", () => {
    expect(lagOf(at(110, 100))).toBe(10);
    expect(lagOf(at(100, 100))).toBe(0);
    expect(lagOf(at(100, 101))).toBe(0);
  });

  it.each([
    [at(100, 100), "current"],
    [at(101, 100), "catching-up"],
    [at(102, 100), "catching-up"],
    [at(103, 100), "delayed"],
    [at(100, 101), "current"],
  ] as const)("calls %j %s", (status, health) => {
    expect(indexingHealth(status, policy)).toBe(health);
  });

  it("reads the allowed lag from the policy", () => {
    expect(indexingHealth(at(105, 100), { maxLagBlocks: 5 })).toBe(
      "catching-up",
    );
    expect(indexingHealth(at(106, 100), { maxLagBlocks: 5 })).toBe("delayed");
  });

  it("reads a status that carries the chain and the time, and refuses anything else", () => {
    const status = {
      chain: "bip122:00000008819873e925422c1ff0f99f7c",
      indexedHeight: 5,
      observedAt: "2026-10-17T12:00:00.000Z",
      tipHeight: 9,
    };
    expect(indexingStatusSchema.parse(status)).toEqual(status);
    expect(
      indexingStatusSchema.safeParse({ ...status, tipHeight: -1 }).success,
    ).toBe(false);
    expect(
      indexingStatusSchema.safeParse({ ...status, extra: 1 }).success,
    ).toBe(false);
    expect(
      indexingStatusSchema.safeParse({ ...status, chain: "nope" }).success,
    ).toBe(false);
  });
});

describe("when a wait is delayed", () => {
  const delayed = (
    stage: TransactionStage,
    sentMinutes: number | null,
    status: ReturnType<typeof at> | null,
  ) =>
    isDelayed({
      now,
      policy,
      sentAt: sentMinutes === null ? null : minutesAgo(sentMinutes),
      stage,
      status,
    });

  it("is not delayed while the indexer is within the allowed lag and the wait is short", () => {
    expect(delayed("pending", 5, at(102, 100))).toBe(false);
    expect(delayed("confirmed", 59, at(100, 100))).toBe(false);
  });

  it("is delayed when the indexer is more than the allowed lag behind, however recent the send", () => {
    expect(delayed("pending", 1, at(103, 100))).toBe(true);
    expect(delayed("confirmed", 1, at(500, 100))).toBe(true);
  });

  it("is delayed when it was sent more than the allowed time ago, and not at exactly that time", () => {
    expect(delayed("pending", 61, at(100, 100))).toBe(true);
    expect(delayed("pending", 60, at(100, 100))).toBe(false);
    expect(delayed("confirmed", 61, null)).toBe(true);
  });

  it("falls back to the time alone when the indexer could not be asked, and to the lag alone when the send time is unknown", () => {
    expect(delayed("pending", 30, null)).toBe(false);
    expect(delayed("pending", null, at(110, 100))).toBe(true);
    expect(delayed("pending", null, null)).toBe(false);
  });

  it("is a statement only about the stages that wait on the network", () => {
    const stages = new Set(trackedStates.map(stageOf));
    const waiting = [...stages].filter((stage) =>
      delayed(stage, 600, at(900, 100)),
    );
    expect(waiting.sort()).toEqual(["confirmed", "pending"]);
  });
});

describe("when a transaction was first sent", () => {
  const earlier = new Date("2026-10-17T11:00:00.000Z");
  const at = new Date("2026-10-17T12:00:00.000Z");

  it("is the moment of the change that brings the network's id, and no earlier change", () => {
    expect(sentAtAfter(null, { transactionId: "abc" }, at)).toBe(at);
    expect(sentAtAfter(null, {}, at)).toBeNull();
    expect(sentAtAfter(null, { transactionId: undefined }, at)).toBeNull();
  });

  it("never moves once set, whatever later changes bring", () => {
    expect(sentAtAfter(earlier, { transactionId: "abc" }, at)).toBe(earlier);
    expect(sentAtAfter(earlier, {}, at)).toBe(earlier);
  });
});
