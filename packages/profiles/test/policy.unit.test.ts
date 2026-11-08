import { profileNameCeiling } from "@frostbite/shared/profiles";
import { describe, expect, it } from "vitest";

import { assertProfilePolicy } from "../src/policy.ts";
import { policy } from "./policy.ts";

describe("refusing a profile policy that cannot work", () => {
  it("accepts a sound policy", () => {
    expect(() => {
      assertProfilePolicy(policy);
    }).not.toThrow();
    expect(() => {
      assertProfilePolicy({ ...policy, changeCooldownDays: 0 });
    }).not.toThrow();
  });

  it.each([
    { minLength: 0 },
    { minLength: 5, maxLength: 4 },
    { maxLength: profileNameCeiling + 1 },
    { minLength: 2.5 },
    { changeCooldownDays: -1 },
    { changeCooldownDays: 1.5 },
    { blockedTerms: ["Has Space"] },
    { blockedTerms: ["UPPER"] },
    { blockedTerms: [""] },
  ])("refuses %j", (change) => {
    expect(() => {
      assertProfilePolicy({ ...policy, ...change });
    }).toThrow();
  });
});
