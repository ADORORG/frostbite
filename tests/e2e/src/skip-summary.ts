// What a Playwright run skipped, grouped so a skip on a phone cannot go unseen. A skipped test is neither a pass nor a failure, so
// the run's own totals hide it; this is the line that says which projects did not run which specs, and why.
export interface SkippedTest {
  readonly file: string;
  readonly project: string;
  readonly reason: string;
}

const noReason = "no reason given";

export function summariseSkips(skipped: readonly SkippedTest[]): string[] {
  const lines = new Set<string>();
  for (const { file, project, reason } of skipped)
    lines.add(
      `${project}: ${file} (${reason.trim() === "" ? noReason : reason.trim()})`,
    );
  if (lines.size === 0) return [];
  const counts = new Map<string, number>();
  for (const { project } of skipped)
    counts.set(project, (counts.get(project) ?? 0) + 1);
  return [
    `Skipped tests: ${[...counts].map(([project, count]) => `${project} ${String(count)}`).join(", ")}`,
    ...[...lines].sort().map((line) => `  ${line}`),
  ];
}
