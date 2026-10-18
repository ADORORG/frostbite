// What one check found. `unverified` is not a pass: the check could not be made (the node did not answer), so nothing is claimed.
// `skipped` means an earlier check failed and this one depends on it.
export type Verdict = "pass" | "fail" | "unverified" | "skipped";

export interface CheckResult {
  readonly detail: string;
  readonly name: string;
  readonly verdict: Verdict;
}

const marks: Readonly<Record<Verdict, string>> = {
  fail: "FAIL      ",
  pass: "PASS      ",
  skipped: "SKIPPED   ",
  unverified: "UNVERIFIED",
};

export const formatReport = (results: readonly CheckResult[]): string =>
  results
    .map(
      ({ detail, name, verdict }) =>
        `${marks[verdict]} ${name}\n           ${detail}`,
    )
    .join("\n");

// 0 only when every check passed; 1 when something is wrong; 2 when nothing is wrong but something could not be checked.
export function exitCodeOf(results: readonly CheckResult[]): 0 | 1 | 2 {
  if (
    results.some(({ verdict }) => verdict === "fail" || verdict === "skipped")
  )
    return 1;
  return results.some(({ verdict }) => verdict === "unverified") ? 2 : 0;
}

// A caught value is of unknown type by definition; it is only ever shown as text, never read as anything else.
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
