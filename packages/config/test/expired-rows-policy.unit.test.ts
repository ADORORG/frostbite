import { describe, expect, it } from "vitest";

import { emailCodePolicy } from "../src/policy/email-code.ts";
import { expiredRowPolicy } from "../src/policy/expired-rows.ts";

// The numbers are a decision; these hold the relations that keep the sweeps from removing something that is still read.
describe("the expired row policy", () => {
  it("keeps a contact code at least as long as the send limits look back over, since they count expired codes too", () => {
    expect(expiredRowPolicy.contactCodeRetentionMs).toBeGreaterThanOrEqual(
      emailCodePolicy.sendWindowMs,
    );
  });

  it("keeps a contact code longer than it lives, so what is removed has always expired", () => {
    expect(expiredRowPolicy.contactCodeRetentionMs).toBeGreaterThan(
      emailCodePolicy.lifetimeMs,
    );
  });

  it("removes in batches of whole rows, never an unbounded sweep", () => {
    expect(Number.isInteger(expiredRowPolicy.batchSize)).toBe(true);
    expect(expiredRowPolicy.batchSize).toBeGreaterThanOrEqual(1);
    expect(expiredRowPolicy.batchSize).toBeLessThanOrEqual(5_000);
  });

  it("leaves a delivered event looked at for at least a day before it goes", () => {
    expect(expiredRowPolicy.deliveredOutboxRetentionMs).toBeGreaterThanOrEqual(
      24 * 60 * 60 * 1000,
    );
  });
});
