import { describe, expect, it } from "vitest";

import { mintedDay } from "../src/domain/minted-view.ts";

describe("the day of a mint", () => {
  it("is the day in UTC, not the reader's, so a late-evening mint reads the same everywhere", () => {
    expect(mintedDay("2026-10-17T12:34:56.000Z")).toBe("17 Oct 2026");
    expect(mintedDay("2026-10-17T23:59:59.000Z")).toBe("17 Oct 2026");
    expect(mintedDay("2026-10-18T00:00:00.000Z")).toBe("18 Oct 2026");
  });
});
