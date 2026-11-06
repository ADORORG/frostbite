import { summariseSkips, type SkippedTest } from "./skip-summary.ts";

// The parts of Playwright's reporter API this file reads. They are written out here, not imported from `@playwright/test/reporter`, because the
// repository's import-boundary check refuses any package path that contains `/test/`; Playwright calls these methods by name.
interface EndedTest {
  readonly annotations: readonly { type: string; description?: string }[];
  readonly location: { file: string };
  readonly parent: { project(): { name: string } | undefined };
}

// Prints, after the run, every test a project skipped and the reason it gave (`test.skip(condition, "reason")`).
export default class SkipReporter {
  private readonly skipped: SkippedTest[] = [];

  onTestEnd(test: EndedTest, result: { status: string }): void {
    if (result.status !== "skipped") return;
    this.skipped.push({
      file: test.location.file.replace(/^.*\/tests\//u, "tests/"),
      project: test.parent.project()?.name ?? "unknown",
      reason:
        test.annotations.find(({ type }) => type === "skip")?.description ?? "",
    });
  }

  onEnd(): void {
    for (const line of summariseSkips(this.skipped))
      process.stdout.write(`${line}\n`);
  }

  printsToStdio(): boolean {
    return true;
  }
}
