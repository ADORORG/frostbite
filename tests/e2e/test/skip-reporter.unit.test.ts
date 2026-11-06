import { afterEach, describe, expect, it, vi } from "vitest";

import SkipReporter from "../src/skip-reporter.ts";

const ended = (
  project: string | undefined,
  annotations: readonly { type: string; description?: string }[] = [],
) => ({
  annotations,
  location: { file: "/work/repo/tests/e2e/tests/a.spec.ts" },
  parent: {
    project: () => (project === undefined ? undefined : { name: project }),
  },
});

describe("SkipReporter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints each skipped test with its project and the reason it gave, and ignores passes", () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const reporter = new SkipReporter();
    reporter.onTestEnd(
      ended("mobile", [{ type: "skip", description: "Desktop only." }]),
      { status: "skipped" },
    );
    reporter.onTestEnd(ended("mobile"), { status: "passed" });
    reporter.onEnd();
    expect(write.mock.calls.map(([line]) => line)).toEqual([
      "Skipped tests: mobile 1\n",
      "  mobile: tests/a.spec.ts (Desktop only.)\n",
    ]);
  });

  it("names a skip with no project or reason, and prints nothing when nothing was skipped", () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const none = new SkipReporter();
    none.onEnd();
    expect(write).not.toHaveBeenCalled();
    const reporter = new SkipReporter();
    reporter.onTestEnd(ended(undefined), { status: "skipped" });
    reporter.onEnd();
    expect(write.mock.calls.map(([line]) => line)).toContain(
      "  unknown: tests/a.spec.ts (no reason given)\n",
    );
    expect(reporter.printsToStdio()).toBe(true);
  });
});
