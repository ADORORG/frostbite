import { describe, expect, it } from "vitest";

import { shareCopy } from "../src/domain/share-copy.ts";
import { verificationLabel } from "../src/domain/verification-label.ts";

describe("what a shared thing says about how it is known", () => {
  it("says it was verified by replay when it was", () => {
    expect(verificationLabel("replay-verified")).toBe(shareCopy.verification);
  });

  it("says nothing for a reported one, or for one with no level", () => {
    expect(verificationLabel("self-reported")).toBeNull();
    expect(verificationLabel(null)).toBeNull();
  });
});
