import { describe, expect, it } from "vitest";

import { createProfilesResolver } from "../src/runtime.ts";
import { policy } from "./support/profile-api.ts";

// A database that is never reached: nothing below asks storage for anything.
const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "1",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:1/none",
} as const;
const rules = { ...policy, blockedTerms: ["admin"] };

describe("the profiles runtime", () => {
  it("makes the service and the reader of a profile page's records once, on first use", async () => {
    const resolve = createProfilesResolver(
      rules,
      new Set(["frost-runner"]),
      environment,
    );
    const first = await resolve();
    expect(await resolve()).toBe(first);
    expect(first.service.policy).toEqual(rules);
    expect(await first.service.checkName("u1", "a b")).toEqual({
      reason: "bad-characters",
      status: "invalid",
    });
  });

  it("refuses a policy that cannot work, when first used, and tries again next time", async () => {
    const resolve = createProfilesResolver(
      { ...rules, minLength: 9, maxLength: 3 },
      new Set(),
      environment,
    );
    await expect(resolve()).rejects.toThrow(/length/u);
    await expect(resolve()).rejects.toThrow(/length/u);
  });
});
