import { authorizationPolicySchema } from "@ador/shared/accounts";
import { collectionReviewCapability } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import { authorizationPolicy } from "../src/policy/authorization.ts";

describe("authorization policy", () => {
  it("is valid and separates creator review from platform operations", () => {
    expect(authorizationPolicySchema.parse(authorizationPolicy)).toEqual(
      authorizationPolicy,
    );
    expect(authorizationPolicy.platform.reviewer).toContain("creator:review");
    expect(authorizationPolicy.platform.staff).not.toContain("creator:review");
  });

  it("lets reviewers, and only reviewers, decide on collection submissions", () => {
    expect(authorizationPolicy.platform.reviewer).toContain(
      collectionReviewCapability,
    );
    expect(authorizationPolicy.platform.staff).not.toContain(
      collectionReviewCapability,
    );
  });
});
