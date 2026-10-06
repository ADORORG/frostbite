import { describe, expect, it } from "vitest";

import {
  defaultOutboxRelayPolicy,
  defaultRelayLoopPolicy,
  defaultWorkflowPolicy,
  resolveWorkflowPolicy,
} from "../src/workflow-policy.ts";

describe("workflow policy", () => {
  it("owns frozen typed defaults", () => {
    expect(defaultWorkflowPolicy).toEqual({
      maxConcurrentMediaRuns: 2,
      retries: 4,
    });
    expect(defaultRelayLoopPolicy).toEqual({
      errorDelayMs: 5_000,
      idleDelayMs: 2_000,
    });
    expect(defaultOutboxRelayPolicy).toMatchObject({
      batchSize: 10,
      maxAttempts: 8,
    });
    for (const value of [
      defaultWorkflowPolicy,
      defaultRelayLoopPolicy,
      defaultOutboxRelayPolicy,
      resolveWorkflowPolicy(),
    ])
      expect(Object.isFrozen(value)).toBe(true);
  });

  it("merges overrides and accepts the bounds", () => {
    expect(resolveWorkflowPolicy({ retries: 0 }).retries).toBe(0);
    expect(
      resolveWorkflowPolicy({ retries: 20, maxConcurrentMediaRuns: 64 }),
    ).toEqual({ maxConcurrentMediaRuns: 64, retries: 20 });
    expect(
      resolveWorkflowPolicy({ maxConcurrentMediaRuns: 1 })
        .maxConcurrentMediaRuns,
    ).toBe(1);
  });

  it.each([
    { retries: -1 },
    { retries: 21 },
    { retries: 1.5 },
    { maxConcurrentMediaRuns: 0 },
    { maxConcurrentMediaRuns: 65 },
  ])("rejects %j", (overrides) => {
    expect(() => resolveWorkflowPolicy(overrides)).toThrow();
  });
});
