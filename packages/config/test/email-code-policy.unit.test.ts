import { describe, expect, it } from "vitest";

import { emailCodePolicy } from "../src/policy/email-code.ts";

// The numbers are a decision (ADR-021 point 9); these tests hold the relations that make them safe, so a change that breaks one is
// seen at review instead of in production.
describe("the email code policy", () => {
  it("keeps a code between six and eight digits", () => {
    expect(emailCodePolicy.codeLength).toBeGreaterThanOrEqual(6);
    expect(emailCodePolicy.codeLength).toBeLessThanOrEqual(8);
  });

  it("allows a guesser too few tries to matter: under one in a thousand of the code space", () => {
    const space = 10 ** emailCodePolicy.codeLength;
    expect(emailCodePolicy.maximumAttempts / space).toBeLessThan(0.001);
  });

  it("lets a person ask again before the code runs out, but not so often that sends pile up", () => {
    expect(emailCodePolicy.resendCooldownMs).toBeLessThan(
      emailCodePolicy.lifetimeMs,
    );
    expect(emailCodePolicy.sendWindowMs).toBeGreaterThan(
      emailCodePolicy.lifetimeMs,
    );
    expect(emailCodePolicy.maximumSendsPerWindow).toBeGreaterThanOrEqual(2);
  });
});
