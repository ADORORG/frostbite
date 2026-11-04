import { describe, expect, it } from "vitest";

import { emailAddressPolicy } from "../src/policy/email-addresses.ts";

// The number is a decision (ADR-021 point 6, open item); these hold the relations that make it usable, so a change that breaks one is
// seen at review.
describe("the email address policy", () => {
  it("is a whole number of addresses", () => {
    expect(Number.isInteger(emailAddressPolicy.maximumPerAccount)).toBe(true);
  });

  it("leaves room to add a new address before removing an old one, which a limit of one would not", () => {
    expect(emailAddressPolicy.maximumPerAccount).toBeGreaterThanOrEqual(2);
  });

  it("stays a handful: each address is a way in to the account", () => {
    expect(emailAddressPolicy.maximumPerAccount).toBeLessThanOrEqual(10);
  });
});
