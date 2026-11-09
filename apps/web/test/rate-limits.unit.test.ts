import { chainFeesRoute, chainIndexingRoute } from "@frostbite/shared/chain";
import { recordGamePlayRoute } from "@frostbite/shared/games";
import { resolveRateLimit } from "@frostbite/shared/http";
import { describe, expect, it } from "vitest";

import { rateLimits } from "@repo/configs/rate-limits";

// Signing in is a guess an attacker can repeat, so every step of it has a limit of its own, tighter than the anonymous default that
// would otherwise apply to a route with no session. A new sign-in step must be added here as well as to the limits.
const signInSteps = [
  "beginPasskeySignIn",
  "finishPasskeySignIn",
  "beginWalletSignIn",
  "verifyWalletSignIn",
  "redeemSetupLink",
  "requestEmailCode",
  "verifyEmailCode",
  "requestEmailLinkCode",
  "verifyEmailLinkCode",
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

// Every open page asks both public chain routes about twice a minute, and so does every tab: they are counted apart from the rest of what
// someone not signed in does, and allow more than the anonymous default, so a few tabs or a shared address do not make the status unknown.
describe("the limits on the public chain status", () => {
  it.each([chainFeesRoute, chainIndexingRoute])(
    "$operationId has its own bucket, above the anonymous default",
    ({ method, operationId }) => {
      const resolved = resolveRateLimit(rateLimits, {
        authenticated: false,
        method,
        operationId,
      });
      expect(resolved.bucket).toBe(operationId);
      expect(resolved.policy.limit).toBeGreaterThan(rateLimits.anonymous.limit);
    },
  );
});

// A start is counted for anyone, so what keeps a visitor from raising a game's count is this limit: its own bucket, well under the anonymous
// default, and only a few starts a minute (a person starts a run every few seconds at the very most).
describe("the limit on counting a started run", () => {
  it("has its own bucket, a few a minute, below the anonymous default", () => {
    const resolved = resolveRateLimit(rateLimits, {
      authenticated: false,
      method: recordGamePlayRoute.method,
      operationId: recordGamePlayRoute.operationId,
    });
    expect(resolved.bucket).toBe(recordGamePlayRoute.operationId);
    expect(resolved.policy.limit).toBeLessThanOrEqual(10);
    expect(resolved.policy.limit).toBeLessThan(rateLimits.anonymous.limit);
    expect(resolved.policy.windowMs).toBe(60_000);
  });
});
