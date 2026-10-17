import { describe, expect, it } from "vitest";

import { lampFor, unreachableLamp } from "../src/domain/copy.ts";

const ok = (health: "catching-up" | "current" | "delayed", lag: number) =>
  lampFor({
    chain: "Bitcoin signet",
    health,
    indexedHeight: 100,
    lag,
    observedAt: "2026-10-17T12:00:00.000Z",
    state: "ok",
    tipHeight: 100 + lag,
  });

describe("what the lamp says", () => {
  it("is green and plain when the indexer has read everything", () => {
    expect(ok("current", 0)).toMatchObject({
      label: "Chain in sync",
      tone: "ready",
    });
    expect(ok("current", 0).detail).toContain("block 100 of 100");
  });

  it("says how far behind it is, in the right number, while that is normal", () => {
    expect(ok("catching-up", 1)).toMatchObject({
      label: "1 block behind",
      tone: "ready",
    });
    expect(ok("catching-up", 2).label).toBe("2 blocks behind");
    expect(ok("catching-up", 2).detail).toContain("normal");
  });

  it("calls a long lag delayed and says outright that nothing sent has failed", () => {
    const delayed = ok("delayed", 12);
    expect(delayed).toMatchObject({
      label: "Delayed, 12 blocks behind",
      tone: "attention",
    });
    expect(delayed.detail).toContain("have not failed");
    expect(delayed.detail).toContain("block 100 of 112");
  });

  it("is neutral, and claims nothing, when the chain could not be asked or the platform could not be reached", () => {
    const unavailable = lampFor({
      chain: "Bitcoin signet",
      state: "unavailable",
    });
    expect(unavailable).toMatchObject({
      label: "Chain status unknown",
      tone: "neutral",
    });
    expect(unavailable.detail).toContain("Bitcoin signet");
    expect(unreachableLamp).toMatchObject({
      label: "Chain status unknown",
      tone: "neutral",
    });
  });
});
