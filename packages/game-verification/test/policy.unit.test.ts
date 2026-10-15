import { maxRunInputs, maxRunRecordBytes } from "@ador/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import {
  defaultVerificationPolicy,
  resolveVerificationPolicy,
} from "../src/policy.ts";

describe("the verification policy", () => {
  it("defaults to the SDK's ceilings, and is frozen", () => {
    expect(defaultVerificationPolicy).toEqual({
      maxInputs: maxRunInputs,
      maxRecordBytes: maxRunRecordBytes,
      replayTimeoutMs: 2_000,
    });
    expect(Object.isFrozen(resolveVerificationPolicy())).toBe(true);
  });

  it("may be lowered, never raised past the ceilings, and never made meaningless", () => {
    expect(resolveVerificationPolicy({ maxInputs: 10 }).maxInputs).toBe(10);
    expect(
      resolveVerificationPolicy({ maxRecordBytes: 256 }).maxRecordBytes,
    ).toBe(256);
    for (const bad of [
      { maxInputs: 0 },
      { maxInputs: maxRunInputs + 1 },
      { maxInputs: 1.5 },
      { maxRecordBytes: 255 },
      { maxRecordBytes: maxRunRecordBytes + 1 },
      { replayTimeoutMs: 49 },
      { replayTimeoutMs: 10_001 },
      { replayTimeoutMs: 1.5 },
    ])
      expect(() => resolveVerificationPolicy(bad)).toThrow();
    expect(() => resolveVerificationPolicy({ extra: 1 } as never)).toThrow();
  });
});
