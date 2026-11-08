import { describe, expect, it } from "vitest";

import { readableOn } from "../src/colour.ts";

describe("which ink to put on a colour", () => {
  it("is light on dark and on mid colours, and dark on bright ones", () => {
    expect(readableOn("#000000")).toBe("light");
    expect(readableOn("#1877f2")).toBe("light");
    expect(readableOn("#0a66c2")).toBe("light");
    expect(readableOn("#25d366")).toBe("dark");
    expect(readableOn("#ffd23f")).toBe("dark");
    expect(readableOn("#ffffff")).toBe("dark");
  });
});
