import { platformFeeRefusals } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import {
  platformFeeRefusalCopy,
  shortAddress,
  unitsLabel,
} from "../src/domain/mint-copy.ts";

describe("amounts as staff read them", () => {
  it("group the digits and name the unit, exactly, for amounts past what a plain number holds", () => {
    expect(unitsLabel("0")).toBe("0 sats");
    expect(unitsLabel("1500")).toBe("1,500 sats");
    expect(unitsLabel("9007199254740993")).toBe("9,007,199,254,740,993 sats");
  });
});

describe("a wallet address in a list", () => {
  it("is shown whole when short, and by its ends when long, so none fills a row", () => {
    expect(shortAddress("sim:one:a1b2")).toBe("sim:one:a1b2");
    expect(
      shortAddress(
        "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0",
      ),
    ).toBe("bc1p0xlx…zk5jj0");
  });
});

describe("what a refused fee setting says", () => {
  it("says something different, and says nothing was changed, for every reason the platform can refuse", () => {
    const words = platformFeeRefusals.map((reason) =>
      platformFeeRefusalCopy({
        limitUnits: "294",
        reason,
        status: "refused",
      }),
    );
    expect(new Set(words).size).toBe(platformFeeRefusals.length);
    for (const sentence of words)
      expect(sentence).toContain("Nothing was changed.");
  });

  it("names the limit that was crossed, in sats, for the two refusals that have one", () => {
    expect(
      platformFeeRefusalCopy({
        limitUnits: "100000",
        reason: "above-maximum",
        status: "refused",
      }),
    ).toContain("100,000 sats");
    expect(
      platformFeeRefusalCopy({
        limitUnits: "294",
        reason: "below-minimum-output",
        status: "refused",
      }),
    ).toContain("at least 294 sats, or 0 for no fee");
  });
});
