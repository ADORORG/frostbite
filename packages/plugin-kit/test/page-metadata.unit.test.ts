import { describe, expect, it } from "vitest";

import {
  clipDescription,
  descriptionLimit,
  privatePage,
} from "../src/page-metadata.ts";

describe("clipDescription", () => {
  it("returns short text as it is, with its spacing flattened", () => {
    expect(clipDescription("  Play\n  and   earn ")).toBe("Play and earn");
  });

  it("keeps text exactly at the limit", () => {
    const exact = "a".repeat(descriptionLimit);
    expect(clipDescription(exact)).toBe(exact);
  });

  it("cuts at a word boundary and marks the cut", () => {
    const clipped = clipDescription("alpha beta gamma delta", 14);
    expect(clipped).toBe("alpha beta…");
    expect(clipped.length).toBeLessThanOrEqual(14);
  });

  it("drops punctuation left dangling before the mark", () => {
    expect(clipDescription("alpha beta, gamma delta", 15)).toBe("alpha beta…");
  });

  it("cuts mid-word when the text has no usable space", () => {
    const clipped = clipDescription("x".repeat(50), 10);
    expect(clipped).toBe(`${"x".repeat(9)}…`);
  });

  it("never exceeds the limit", () => {
    const text = "word ".repeat(200);
    expect(clipDescription(text).length).toBeLessThanOrEqual(descriptionLimit);
  });
});

describe("privatePage", () => {
  it("is a frozen private declaration", () => {
    expect(privatePage).toEqual({ kind: "private" });
    expect(Object.isFrozen(privatePage)).toBe(true);
  });
});
