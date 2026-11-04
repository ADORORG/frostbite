import { expiredRowLimitsSchema } from "@ador/database";
import { expiredRowPolicy } from "@repo/configs/expired-rows";
import { describe, expect, it } from "vitest";

import { rowSweepLimitsOf } from "../src/sweep-limits.ts";

describe("the limits a row sweep takes from the platform's policy", () => {
  it("are accepted by the removal itself, with the real policy (which carries a version the removal does not know)", () => {
    expect(expiredRowPolicy).toHaveProperty("version");
    expect(() =>
      expiredRowLimitsSchema.parse(rowSweepLimitsOf(expiredRowPolicy)),
    ).not.toThrow();
  });

  it("are the policy's numbers, each in its own place", () => {
    expect(
      rowSweepLimitsOf({
        batchSize: 1,
        contactCodeRetentionMs: 2,
        deliveredOutboxRetentionMs: 3,
      }),
    ).toEqual({
      batchSize: 1,
      contactCodeRetentionMs: 2,
      deliveredOutboxRetentionMs: 3,
    });
  });
});
