import { describe, expect, it } from "vitest";

import { summariseSkips } from "../src/skip-summary.ts";

describe("summariseSkips", () => {
  it("says nothing when nothing was skipped", () => {
    expect(summariseSkips([])).toEqual([]);
  });

  it("counts skips per project and lists each spec once with its reason", () => {
    const lines = summariseSkips([
      { file: "tests/a.spec.ts", project: "mobile", reason: "Desktop only." },
      { file: "tests/a.spec.ts", project: "mobile", reason: "Desktop only." },
      {
        file: "tests/b.spec.ts",
        project: "tablet",
        reason: "Small screens only.",
      },
    ]);
    expect(lines).toEqual([
      "Skipped tests: mobile 2, tablet 1",
      "  mobile: tests/a.spec.ts (Desktop only.)",
      "  tablet: tests/b.spec.ts (Small screens only.)",
    ]);
  });

  it("lists the specs in a fixed order, whatever order they were skipped in", () => {
    const lines = summariseSkips([
      { file: "tests/b.spec.ts", project: "tablet", reason: "x" },
      { file: "tests/a.spec.ts", project: "mobile", reason: "x" },
    ]);
    expect(lines.slice(1)).toEqual([
      "  mobile: tests/a.spec.ts (x)",
      "  tablet: tests/b.spec.ts (x)",
    ]);
  });

  it("names a skip that gave no reason, so it cannot hide", () => {
    expect(
      summariseSkips([
        { file: "tests/c.spec.ts", project: "mobile", reason: "  " },
      ]),
    ).toContain("  mobile: tests/c.spec.ts (no reason given)");
  });
});
