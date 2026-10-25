import { describe, expect, it } from "vitest";

import { rateLimits } from "../../../configs/rate-limits";

// Signing in is a guess an attacker can repeat, so every step of it has a limit of its own, tighter than the anonymous default that
// would otherwise apply to a route with no session. A new sign-in step must be added here as well as to the limits.
const signInSteps = [
  "beginPasskeySignIn",
  "finishPasskeySignIn",
  "beginWalletSignIn",
  "verifyWalletSignIn",
  "redeemSetupLink",
];

describe("the limits on signing in", () => {
  it.each(signInSteps)(
    "%s has its own limit, below the anonymous default",
    (id) => {
      const limit = rateLimits.operations[id];
      expect(limit).toBeDefined();
      expect(limit?.limit).toBeLessThanOrEqual(20);
      expect(limit?.limit).toBeLessThan(rateLimits.anonymous.limit);
    },
  );
});
