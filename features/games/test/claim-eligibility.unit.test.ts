import { describe, expect, it } from "vitest";

import { claimableAt } from "../src/domain/claim-eligibility.ts";

describe("which level a milestone can be claimed at", () => {
  it("lets a milestone with no stated level be claimed at either level, and not before it is earned", () => {
    expect(claimableAt({}, "self-reported")).toBe(true);
    expect(claimableAt({}, "replay-verified")).toBe(true);
    expect(claimableAt({}, null)).toBe(false);
  });

  it("lets a milestone the manifest calls self-reported be claimed at either level", () => {
    const milestone = { verification: "self-reported" } as const;
    expect(claimableAt(milestone, "self-reported")).toBe(true);
    expect(claimableAt(milestone, "replay-verified")).toBe(true);
  });

  it("lets a milestone only a replay can prove be claimed on a verified level alone", () => {
    const milestone = { verification: "replay-verified" } as const;
    expect(claimableAt(milestone, "replay-verified")).toBe(true);
    expect(claimableAt(milestone, "self-reported")).toBe(false);
    expect(claimableAt(milestone, null)).toBe(false);
  });
});
