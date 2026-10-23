import { describe, expect, it } from "vitest";

import { costText, rateText, waitText } from "../src/domain/fee-copy.ts";

describe("telling a wait", () => {
  it("is minutes below an hour, and hours in halves from there, always 'about'", () => {
    expect(waitText(15)).toBe("about 15 min");
    expect(waitText(30)).toBe("about 30 min");
    expect(waitText(59.6)).toBe("about 60 min");
    expect(waitText(60)).toBe("about 1 h");
    expect(waitText(250)).toBe("about 4 h");
    expect(waitText(225)).toBe("about 4 h");
    expect(waitText(95)).toBe("about 1.5 h");
  });
});

describe("telling a rate", () => {
  it("keeps two decimals under ten so a small rate is not rounded away, and rounds above", () => {
    expect(rateText(1.009)).toBe("1.01 sat/vB");
    expect(rateText(0.495)).toBe("0.49 sat/vB");
    expect(rateText(9.994)).toBe("9.99 sat/vB");
    expect(rateText(10)).toBe("10 sat/vB");
    expect(rateText(31.056)).toBe("31 sat/vB");
    expect(rateText(588_235.294)).toBe("588,235 sat/vB");
  });
});

describe("telling a cost", () => {
  it("rounds up, with thousands separated", () => {
    expect(costText(1.009, 200)).toBe("202 sats");
    expect(costText(588_235.294, 200)).toBe("117,647,059 sats");
    expect(costText(2, 100.5)).toBe("201 sats");
  });
});
